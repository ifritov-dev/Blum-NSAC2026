import { Check, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ModelInfo } from "../../types/agent";

const EFFORT_LABELS: Record<string, string> = {
  none: "Off",
  low: "Low",
  medium: "Med",
  high: "High",
  xhigh: "Max",
};

interface ModelPopoverProps {
  models: ModelInfo[];
  selectedModel: string;
  selectedEffort: string;
  availableEfforts: string[];
  onModelChange: (id: string) => void;
  onEffortChange: (effort: string) => void;
}

export function ModelPopover({
  models,
  selectedModel,
  selectedEffort,
  availableEfforts,
  onModelChange,
  onEffortChange,
}: ModelPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onOutside);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onOutside);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const modelList: ModelInfo[] = models.length
    ? models
    : [{ id: selectedModel, display_name: selectedModel, efforts: availableEfforts, reasoning: true }];

  const currentLabel = modelList.find((m) => m.id === selectedModel)?.display_name || selectedModel;
  const effortShort =
    availableEfforts.length && selectedEffort ? EFFORT_LABELS[selectedEffort] || selectedEffort : "";

  return (
    <div ref={rootRef} className="relative">
      {open && (
        <div className="absolute right-0 bottom-full z-30 mb-2 w-72 overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-card)] shadow-[0_14px_34px_rgba(0,0,0,0.2)]">
          <div className="border-b border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2">
            <div className="text-[11px] font-medium text-[var(--ink-muted)]">Model</div>
          </div>

          <div className="no-scrollbar max-h-48 overflow-y-auto p-1.5 space-y-0.5">
            {modelList.map((m) => {
              const active = m.id === selectedModel;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onModelChange(m.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left transition-colors ${
                    active
                      ? "bg-[var(--action-soft)] text-[var(--ink)]"
                      : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium">{m.display_name}</span>
                      {m.reasoning && (
                        <span className="rounded bg-[var(--bg-subtle)] px-1 py-0.5 text-[9.5px] font-medium text-[var(--ink-muted)]">
                          Reasoning
                        </span>
                      )}
                    </div>
                    <div className="truncate font-mono text-[10px] text-[var(--ink-muted)]">{m.id}</div>
                  </div>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--action)]" />}
                </button>
              );
            })}
          </div>

          {availableEfforts.length > 0 && (
            <div className="border-t border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5">
              <div className="mb-1.5 text-[11px] font-medium text-[var(--ink-muted)]">
                Thinking effort
              </div>
              <div
                className="grid gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-sidebar)] p-0.5"
                style={{ gridTemplateColumns: `repeat(${availableEfforts.length}, minmax(0, 1fr))` }}
              >
                {availableEfforts.map((eff) => {
                  const active = eff === selectedEffort;
                  return (
                    <button
                      key={eff}
                      type="button"
                      onClick={() => onEffortChange(eff)}
                      className={`rounded-lg py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? "bg-[var(--bg-card)] text-[var(--action)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                          : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {EFFORT_LABELS[eff] || eff}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`psi-btn inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${
          open
            ? "border-[var(--action)] bg-[var(--action-soft)] text-[var(--action)]"
            : "border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--ink-secondary)] hover:text-[var(--ink)]"
        }`}
      >
        <span className="truncate max-w-[140px]">{currentLabel}</span>
        {effortShort && (
          <span className="rounded-full bg-[var(--bg-subtle)] px-1.5 py-0.2 text-[10px] font-medium text-[var(--ink-muted)]">
            {effortShort}
          </span>
        )}
        <ChevronUp className={`h-3 w-3 shrink-0 text-[var(--ink-muted)] transition-transform ${open ? "rotate-180 text-[var(--action)]" : ""}`} />
      </button>
    </div>
  );
}
