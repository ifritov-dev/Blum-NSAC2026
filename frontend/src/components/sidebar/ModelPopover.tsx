import { Brain, Check, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const EFFORT_LABELS: Record<string, string> = {
  none: "Off",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Max",
};

const EFFORT_SHORT_LABELS: Record<string, string> = {
  none: "Off",
  low: "Low",
  medium: "Med",
  high: "High",
  xhigh: "Max",
};

interface ModelPopoverProps {
  selectedEffort: string;
  availableEfforts: string[];
  onEffortChange: (effort: string) => void;
}

export function ModelPopover({
  selectedEffort,
  availableEfforts,
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

  if (availableEfforts.length === 0) return null;

  const effortShort = selectedEffort ? EFFORT_SHORT_LABELS[selectedEffort] || selectedEffort : "Med";

  return (
    <div ref={rootRef} className="relative">
      {open && (
        <div className="absolute right-0 bottom-full z-30 mb-2 w-48 overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-card)] shadow-[0_14px_34px_rgba(0,0,0,0.2)]">
          <div className="border-b border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2">
            <div className="text-[11px] font-medium text-[var(--ink-muted)]">Thinking effort</div>
          </div>

          <div className="p-1.5 space-y-0.5">
            {availableEfforts.map((eff) => {
              const active = eff === selectedEffort;
              return (
                <button
                  key={eff}
                  type="button"
                  onClick={() => {
                    onEffortChange(eff);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                    active
                      ? "bg-[var(--action-soft)] text-[var(--action)]"
                      : "text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                  }`}
                >
                  <span>{EFFORT_LABELS[eff] || eff}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--action)]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label="Thinking effort"
        className={`psi-btn inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${
          open
            ? "border-[var(--action)] bg-[var(--action-soft)] text-[var(--action)]"
            : "border-[var(--border-strong)] bg-[var(--bg-card)] text-[var(--ink-secondary)] hover:text-[var(--ink)]"
        }`}
      >
        <Brain className="h-3 w-3 shrink-0 text-[var(--ink-muted)]" />
        <span>Thinking</span>
        <span className="rounded-full bg-[var(--bg-subtle)] px-1.5 py-0.2 text-[10px] font-medium text-[var(--ink-muted)]">
          {effortShort}
        </span>
        <ChevronUp className={`h-3 w-3 shrink-0 text-[var(--ink-muted)] transition-transform ${open ? "rotate-180 text-[var(--action)]" : ""}`} />
      </button>
    </div>
  );
}
