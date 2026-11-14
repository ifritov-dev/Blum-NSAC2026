import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { FilterState } from "../../types/psi";

interface FiltersTabProps {
  filters: FilterState;
  maxTests: number;
  onChange: (next: FilterState) => void;
  onReset: () => void;
}

export function FiltersTab({ filters, maxTests, onChange, onReset }: FiltersTabProps) {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <div className="no-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3.5 py-3 space-y-3">
      <p className="text-xs leading-relaxed text-[var(--ink-muted)]">
        Filter the 22 PSI combustion series by name, oxygen, or size.
      </p>

      <div className="space-y-1.5">
        <label htmlFor="psi-search" className="block text-[12px] font-medium text-[var(--ink-secondary)]">
          Series name
        </label>
        <input
          id="psi-search"
          type="text"
          maxLength={100}
          value={filters.search}
          placeholder="e.g. SAFFIRE, FLEX, CFI-G"
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--ink)] placeholder:text-[var(--ink-muted)] outline-none transition-colors focus:border-[var(--action)]"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-xs font-medium text-[var(--ink)] transition-colors hover:border-[var(--border-strong)]">
        <input
          type="checkbox"
          checked={filters.onlyO2}
          onChange={(e) => onChange({ ...filters, onlyO2: e.target.checked })}
          className="h-3.5 w-3.5 rounded accent-[var(--action)]"
        />
        Only series with O₂ data
      </label>

      <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-[var(--ink)]">Series max O₂ at least</span>
          <span className="font-mono font-medium text-[var(--action)] tabular-nums">
            {filters.o2Threshold}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={filters.o2Threshold}
          onChange={(e) => onChange({ ...filters, o2Threshold: Number(e.target.value) })}
          className="psi-range"
        />
        <p className="text-[11px] text-[var(--ink-muted)]">
          Set 30% to focus on lunar habitat conditions.
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-[var(--ink)]">Minimum tests in series</span>
          <span className="font-mono font-medium text-[var(--action)] tabular-nums">
            {filters.minTests}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={maxTests}
          value={filters.minTests}
          onChange={(e) => onChange({ ...filters, minTests: Number(e.target.value) })}
          className="psi-range"
        />
      </div>

      <button
        type="button"
        onClick={onReset}
        className="psi-btn flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--ink)] hover:border-[var(--action)] hover:text-[var(--action)]"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset filters
      </button>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
        <button
          type="button"
          onClick={() => setAboutOpen((p) => !p)}
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[var(--bg-subtle)]"
        >
          <span>About this data</span>
          {aboutOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
          )}
        </button>
        {aboutOpen && (
          <div className="space-y-2 border-t border-[var(--border)] px-3.5 py-3 text-[11.5px] leading-relaxed text-[var(--ink-secondary)]">
            <p>
              Source: NASA Physical Sciences Informatics (PSI), combustion experiments.{" "}
              <a
                href="https://psi.nasa.gov/physci/repo/search?q=combustion"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--action)] underline underline-offset-2"
              >
                Open PSI
              </a>
            </p>
            <p className="text-[var(--ink-muted)]">
              Not in a PSI table does not mean not studied: condition and measurement tables are stored in other PSI files. Partial gravity data (Moon, Mars) is not in PSI yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
