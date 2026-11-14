import { useCallback, useEffect, useRef, useState } from "react";
import { fetchModels, streamAgentTurn, submitFeedback } from "../api/client";
import type { ActiveToolInfo, ChatMessage, TraceStep } from "../types/agent";

export const MAX_QUESTION_LEN = 500;
export const MAX_QUESTIONS_PER_SESSION = 20;
const DEFAULT_EFFORTS = ["none", "low", "medium", "high", "xhigh"];

export interface LiveStreamState {
  status: string;
  startedAt: number;
  finalDurationS: number | null;
  thinking: string;
  steps: TraceStep[];
  activeTools: ActiveToolInfo[];
}

export interface TextStreamBuffer {
  target: string;
  finished: boolean;
}

export function useAgentChat() {
  const [configured, setConfigured] = useState(true);
  const [availableEfforts, setAvailableEfforts] = useState<string[]>(DEFAULT_EFFORTS);
  const [selectedEffort, setSelectedEffort] = useState<string>("medium");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [live, setLive] = useState<LiveStreamState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textBufferRef = useRef<TextStreamBuffer>({ target: "", finished: false });
  const drainResolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    fetchModels()
      .then((res) => {
        setConfigured(res.configured);
        const defInfo = res.models.find((m) => m.id === res.default_model) ?? res.models[0];
        const efforts =
          (res.efforts && res.efforts.length ? res.efforts : defInfo?.efforts) || DEFAULT_EFFORTS;
        setAvailableEfforts(efforts);
        if (efforts.includes(res.default_effort)) {
          setSelectedEffort(res.default_effort);
        } else if (efforts.length > 0) {
          setSelectedEffort(efforts[0]);
        }
      })
      .catch(() => {
        /* fallback defaults stay active */
      });
  }, []);

  const userCount = messages.filter((m) => m.role === "user").length;
  const limitReached = userCount >= MAX_QUESTIONS_PER_SESSION;

  const notifyTextDrained = useCallback(() => {
    drainResolveRef.current?.();
    drainResolveRef.current = null;
  }, []);

  const sendMessage = useCallback(
    async (rawQuestion: string) => {
      const q = rawQuestion.trim().slice(0, MAX_QUESTION_LEN);
      if (!q || live || !configured || limitReached) return;

      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: q };
      const priorHistory = messages.map((m) => ({ role: m.role, content: m.text }));
      setMessages((prev) => [...prev, userMsg]);

      const state: LiveStreamState = {
        status: "Planning & reasoning...",
        startedAt: Date.now(),
        finalDurationS: null,
        thinking: "",
        steps: [],
        activeTools: [],
      };
      textBufferRef.current = { target: "", finished: false };
      let thinkingFlushRaf = 0;

      const scheduleThinkingFlush = () => {
        if (thinkingFlushRaf) return;
        thinkingFlushRaf = requestAnimationFrame(() => {
          thinkingFlushRaf = 0;
          setLive({ ...state });
        });
      };

      const cancelThinkingFlush = () => {
        if (thinkingFlushRaf) {
          cancelAnimationFrame(thinkingFlushRaf);
          thinkingFlushRaf = 0;
        }
      };

      const waitForDrain = () =>
        new Promise<void>((resolve) => {
          drainResolveRef.current = resolve;
        });

      setLive({ ...state });
      const drainPromise = waitForDrain();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let donePayload: {
          text: string;
          thinking: string;
          steps: TraceStep[];
          request_id?: string | null;
          duration_s?: number;
        } | null = null;
        let errorMsg: string | null = null;

        await streamAgentTurn(
          {
            question: q,
            effort: availableEfforts.length ? selectedEffort : null,
            history: priorHistory,
          },
          (ev) => {
            if (ev.type === "ping") return;
            if (ev.type === "started") {
              if (ev.started_at) {
                // Keep client monotonic baseline unless server started_at is coherent with client clock
                const serverMs = ev.started_at * 1000;
                if (Math.abs(Date.now() - serverMs) < 10_000) {
                  state.startedAt = serverMs;
                  setLive({ ...state });
                }
              }
              return;
            }
            if (ev.type === "status" && ev.text) {
              state.status = ev.text;
              cancelThinkingFlush();
              setLive({ ...state });
            } else if (ev.type === "thinking_delta" && ev.delta) {
              state.thinking += ev.delta;
              scheduleThinkingFlush();
            } else if (ev.type === "tool_start" && ev.name) {
              const nextTool: ActiveToolInfo = {
                id: ev.id,
                name: ev.name,
                label: ev.label || `Running ${ev.name}...`,
              };
              const idx = ev.id
                ? state.activeTools.findIndex((t) => t.id === ev.id)
                : state.activeTools.findIndex((t) => t.name === ev.name);
              if (idx >= 0) {
                state.activeTools = state.activeTools.map((t, i) => (i === idx ? nextTool : t));
              } else {
                state.activeTools = [...state.activeTools, nextTool];
              }
              cancelThinkingFlush();
              setLive({ ...state });
            } else if (ev.type === "tool_done" && ev.label) {
              if (ev.id) {
                state.activeTools = state.activeTools.filter((t) => t.id !== ev.id);
              } else {
                const rmIdx = state.activeTools.findIndex((t) => t.name === ev.name);
                if (rmIdx >= 0) {
                  state.activeTools = state.activeTools.filter((_, i) => i !== rmIdx);
                }
              }
              state.steps = [
                ...state.steps,
                { id: ev.id, tool: ev.name || "", label: ev.label, preview: ev.preview || "" },
              ];
              cancelThinkingFlush();
              setLive({ ...state });
            } else if (ev.type === "text_delta" && ev.delta) {
              textBufferRef.current.target += ev.delta;
            } else if (ev.type === "done") {
              const fullText = ev.text || textBufferRef.current.target;
              if (fullText.length > textBufferRef.current.target.length) {
                textBufferRef.current.target = fullText;
              }
              if (ev.duration_s != null) {
                state.finalDurationS = ev.duration_s;
              }
              donePayload = {
                text: fullText,
                thinking: ev.thinking ?? state.thinking,
                steps: ev.steps ?? state.steps,
                request_id: ev.request_id,
                duration_s: ev.duration_s,
              };
            } else if (ev.type === "error") {
              errorMsg = ev.message || "Agent failed to respond.";
            }
          },
          controller.signal,
        );

        textBufferRef.current.finished = true;
        if (!textBufferRef.current.target) {
          notifyTextDrained();
        }
        await drainPromise;

        if (donePayload) {
          const final = donePayload as {
            text: string;
            thinking: string;
            steps: TraceStep[];
            request_id?: string | null;
            duration_s?: number;
          };
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              text: final.text,
              thinking: final.thinking,
              steps: final.steps,
              duration_s: final.duration_s,
              request_id: final.request_id,
              feedback: null,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              text: errorMsg || "Could not get an answer right now. Check your API key or try again.",
            },
          ]);
        }
      } catch (err) {
        textBufferRef.current.finished = true;
        notifyTextDrained();
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              text: (err as Error).message || "Could not get an answer right now.",
            },
          ]);
        }
      } finally {
        cancelThinkingFlush();
        notifyTextDrained();
        abortRef.current = null;
        setLive(null);
      }
    },
    [availableEfforts, configured, limitReached, live, messages, notifyTextDrained, selectedEffort],
  );

  const stopStreaming = useCallback(() => {
    textBufferRef.current.finished = true;
    notifyTextDrained();
    abortRef.current?.abort();
  }, [notifyTextDrained]);

  const clearHistory = useCallback(() => {
    textBufferRef.current.finished = true;
    notifyTextDrained();
    abortRef.current?.abort();
    setLive(null);
    setMessages([]);
  }, [notifyTextDrained]);

  const rateMessage = useCallback(async (msgId: string, requestId: string, rating: "up" | "down") => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, feedback: rating } : m)));
    const ok = await submitFeedback(requestId, rating);
    if (ok) {
      setToast("Feedback sent to Coarena");
      setTimeout(() => setToast(null), 2200);
    }
  }, []);

  return {
    configured,
    selectedEffort,
    availableEfforts,
    setSelectedEffort,
    messages,
    live,
    textBufferRef,
    notifyTextDrained,
    limitReached,
    toast,
    sendMessage,
    stopStreaming,
    clearHistory,
    rateMessage,
  };
}
