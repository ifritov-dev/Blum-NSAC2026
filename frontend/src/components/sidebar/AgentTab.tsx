import { ArrowUp, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LiveStreamState, TextStreamBuffer } from "../../hooks/useAgentChat";
import { MAX_QUESTION_LEN } from "../../hooks/useAgentChat";
import type { ChatMessage } from "../../types/agent";
import { MarkdownBlock } from "../common/MarkdownBlock";
import { AgentMessage } from "./AgentMessage";
import { ElapsedTimer } from "./ElapsedTimer";
import { ModelPopover } from "./ModelPopover";
import { StreamingText } from "./StreamingText";
import { TraceStepsList } from "./TraceStepsList";

const QUICK_PROMPTS = [
  { label: "Moon base (30%+ O₂)", text: "Rank the PSI series most relevant for a lunar base at 30%+ O2 and <=10.2 psi." },
  { label: "Suppression & smoke", text: "Which PSI series cover fire suppression and smoke/aerosol detection?" },
  { label: "Modeling gaps", text: "What parameters are most often missing for predictive flammability modeling?" },
  { label: "CIR vs MSG rigs", text: "Compare the test conditions and fuels across CIR/ACME, MDCA, and MSG series." },
];

interface AgentTabProps {
  configured: boolean;
  selectedEffort: string;
  availableEfforts: string[];
  onEffortChange: (effort: string) => void;
  messages: ChatMessage[];
  live: LiveStreamState | null;
  textBufferRef: React.MutableRefObject<TextStreamBuffer>;
  onTextDrained: () => void;
  limitReached: boolean;
  onSend: (q: string) => void;
  onStop: () => void;
  onClear: () => void;
}

export function AgentTab(props: AgentTabProps) {
  const {
    configured,
    selectedEffort,
    availableEfforts,
    onEffortChange,
    messages,
    live,
    textBufferRef,
    onTextDrained,
    limitReached,
    onSend,
    onStop,
    onClear,
  } = props;

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoStickRef = useRef(true);

  const syncTextareaHeight = useCallback((el?: HTMLTextAreaElement | null) => {
    const target = el ?? textareaRef.current;
    if (!target) return;
    const maxHeight = 144;
    target.style.height = "auto";
    const nextHeight = Math.min(target.scrollHeight, maxHeight);
    target.style.height = `${nextHeight}px`;
    target.style.overflowY = target.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    syncTextareaHeight();
  }, [draft, syncTextareaHeight]);

  const stickToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el && autoStickRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    autoStickRef.current = distFromBottom < 24;
  };

  useEffect(() => {
    autoStickRef.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useLayoutEffect(() => {
    stickToBottom();
  }, [stickToBottom, live?.steps.length, live?.activeTools.length, live?.thinking]);

  const handleSubmit = () => {
    const q = draft.trim();
    if (!q || live || !configured || limitReached) return;
    setDraft("");
    autoStickRef.current = true;
    onSend(q);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="no-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3.5 pt-3 pb-3 space-y-3"
      >
        {!configured && (
          <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-3 py-2 text-xs text-[var(--ink)]">
            Coarena API key is not configured. Add <code>COARENA_API_KEY</code> to{" "}
            <code>.streamlit/secrets.toml</code> or environment variables.
          </div>
        )}

        {messages.length === 0 && !live && (
          <div className="space-y-3 pt-1">
            <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
              Ask about NASA PSI microgravity combustion tables. The agent inspects CSV records and streams its reasoning.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.label}
                  type="button"
                  disabled={!configured}
                  onClick={() => onSend(qp.text)}
                  className="psi-lift rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-left text-[11.5px] font-medium text-[var(--ink)] hover:text-[var(--action)] disabled:opacity-50"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <AgentMessage key={msg.id} message={msg} />
        ))}

        {live && (
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-[11.5px] font-medium text-[var(--action)]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--action)] animate-pulse" />
              <span className="truncate">
                {live.status} · <ElapsedTimer startedAt={live.startedAt} finalDurationS={live.finalDurationS} />
              </span>
            </div>

            {(live.thinking || live.steps.length > 0 || live.activeTools.length > 0) && (
              <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                {live.thinking && (
                  <div className="border-b border-[var(--border)] bg-[var(--bg-subtle)]/75 px-3.5 py-2.5">
                    <div className="max-h-20 overflow-hidden">
                      <div className="think-fade-clamp">
                        <MarkdownBlock content={live.thinking} variant="thinking" />
                      </div>
                    </div>
                  </div>
                )}
                <TraceStepsList steps={live.steps} activeTools={live.activeTools} />
              </div>
            )}

            <StreamingText
              bufferRef={textBufferRef}
              onProgress={stickToBottom}
              onDrain={onTextDrained}
            />
          </div>
        )}

        {limitReached && (
          <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber-soft)] px-3 py-2 text-[11.5px] text-[var(--ink)]">
            Question limit reached for this session (20). Clear chat to start fresh.
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-sidebar)] px-3.5 pt-2.5 pb-2.5">
        <div className="flex items-end gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 py-2 transition-colors focus-within:border-[var(--action)]">
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            maxLength={MAX_QUESTION_LEN}
            disabled={!configured || limitReached}
            placeholder="Ask about PSI combustion tables..."
            onChange={(e) => {
              setDraft(e.target.value);
              syncTextareaHeight(e.currentTarget);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="no-scrollbar max-h-36 min-h-[24px] flex-1 resize-none overflow-y-hidden bg-transparent py-0.5 text-[13px] leading-snug text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none disabled:opacity-50"
          />
          {live ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              className="psi-btn flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--danger)] text-white"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!draft.trim() || !configured || limitReached}
              aria-label="Send message"
              className="psi-btn flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--action)] text-white hover:bg-[var(--action-hover)] disabled:bg-[var(--bg-subtle)] disabled:text-[var(--ink-muted)]"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
          <span className="text-[11px] text-[var(--ink-muted)] whitespace-nowrap">PSI data only</span>
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[var(--ink-muted)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--ink)]"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            )}
            <ModelPopover
              selectedEffort={selectedEffort}
              availableEfforts={availableEfforts}
              onEffortChange={onEffortChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
