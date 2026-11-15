import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { TraceStep } from "../../types/agent";
import { MarkdownBlock } from "../common/MarkdownBlock";
import { TraceStepsList } from "./TraceStepsList";

interface AgentTraceProps {
  steps?: TraceStep[];
  thinking?: string;
  durationS?: number;
}

function summarizeHeadline(steps: TraceStep[], durationS?: number): string {
  const durText = durationS !== undefined ? ` · ${Math.round(durationS)}s` : "";
  if (!steps.length) return `Thought${durText}`;

  const reads = steps.filter((s) => s.tool === "inspect_psi_table").length;
  const searches = steps.filter((s) => s.tool === "search_psi_records").length;

  if (reads > 1) return `Read ${reads} PSI tables (${steps.length} steps${durText})`;
  if (searches > 1) return `Searched ${searches} PSI queries (${steps.length} steps${durText})`;
  return `${steps[steps.length - 1].label} (${steps.length} ${steps.length === 1 ? "step" : "steps"}${durText})`;
}

export function AgentTrace({ steps = [], thinking = "", durationS }: AgentTraceProps) {
  const [traceOpen, setTraceOpen] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);

  const hasSteps = steps.length > 0;
  const hasThinking = Boolean(thinking.trim());
  if (!hasSteps && !hasThinking) return null;

  const headline = summarizeHeadline(steps, durationS);

  return (
    <div className="mb-1 min-w-0">
      <button
        type="button"
        onClick={() => setTraceOpen((prev) => !prev)}
        className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1 text-left text-[11px] font-medium text-[var(--ink-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--action)]" />
        <span className="truncate">{headline}</span>
        {traceOpen ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" />
        )}
      </button>

      {traceOpen && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          {hasThinking && (
            <div className="border-b border-[var(--border)] bg-[var(--bg-subtle)]/75 px-3.5 py-2.5">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setThinkingExpanded((prev) => !prev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setThinkingExpanded((prev) => !prev);
                  }
                }}
                className="cursor-pointer select-text"
              >
                <div className={thinkingExpanded ? "" : "think-fade-clamp"}>
                  <MarkdownBlock content={thinking} variant="thinking" />
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[10.5px] font-medium text-[var(--action)]">
                    {thinkingExpanded ? "Hide full reasoning" : "Show full reasoning"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {hasSteps && <TraceStepsList steps={steps} />}
        </div>
      )}
    </div>
  );
}
