import type { AgentStreamEvent, ModelsResponse } from "../types/agent";
import type { DatasetPayload, FilterState, SeriesDetail } from "../types/psi";

export async function fetchDataset(): Promise<DatasetPayload> {
  const res = await fetch("/api/dataset");
  if (!res.ok) throw new Error("Failed to load PSI dataset");
  return res.json();
}

export async function fetchSeriesDetail(tableId: number): Promise<SeriesDetail> {
  const res = await fetch(`/api/series/${tableId}`);
  if (!res.ok) throw new Error("Failed to load series records");
  return res.json();
}

export function buildExportUrl(fmt: "csv" | "xlsx", filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.minTests > 0) params.set("min_tests", String(filters.minTests));
  if (filters.onlyO2) params.set("only_o2", "true");
  if (filters.o2Threshold > 0) params.set("o2_threshold", String(filters.o2Threshold));
  const qs = params.toString();
  return `/api/export/${fmt}${qs ? `?${qs}` : ""}`;
}

export async function fetchModels(): Promise<ModelsResponse> {
  const res = await fetch("/api/agent/models");
  if (!res.ok) throw new Error("Failed to fetch models");
  return res.json();
}

export async function submitFeedback(requestId: string, rating: "up" | "down"): Promise<boolean> {
  try {
    const res = await fetch("/api/agent/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id: requestId, rating }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

export async function streamAgentTurn(
  payload: {
    question: string;
    effort?: string | null;
    history: Array<{ role: "user" | "assistant"; content: string }>;
  },
  onEvent: (ev: AgentStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) {
    let detail = "Could not reach AI agent.";
    try {
      const err = await res.json();
      if (err?.detail) detail = String(err.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          onEvent(JSON.parse(raw) as AgentStreamEvent);
        } catch {
          /* ignore malformed frame */
        }
      }
    }
  }
}
