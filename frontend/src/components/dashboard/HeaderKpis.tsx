import type { SeriesSummary } from "../../types/psi";

interface HeaderKpisProps {
  totalSeries: number;
  totalTests: number;
  moonSeriesTotal: number;
  filtered: SeriesSummary[];
}

export function HeaderKpis({
  totalSeries,
  totalTests,
  moonSeriesTotal,
  filtered,
}: HeaderKpisProps) {
  const isFiltered = filtered.length !== totalSeries;
  const shownTests = filtered.reduce((acc, s) => acc + s.row_count, 0);
  const shownMoon = filtered.filter((s) => s.o2.max !== null && s.o2.max >= 30).length;

  return (
    <header className="space-y-6">
      <div className="psi-enter border-b border-[var(--border)] pb-6">
        <div className="max-w-2xl">
          <div className="text-[12px] font-medium tracking-[0.01em] text-[var(--ink-muted)]">
            NASA Physical Sciences Informatics · Microgravity Combustion
          </div>
          <h1 className="mt-2 text-[30px] font-medium leading-[1.12] tracking-[-0.03em] text-[var(--ink)] sm:text-[36px]">
            Fire Safety in Space
          </h1>
          <p className="mt-2 text-[14.5px] leading-[1.55] text-[var(--ink-secondary)]">
            Explore 22 NASA PSI combustion test series to support spacecraft, lunar habitat, and Mars fire safety.
          </p>
        </div>
      </div>

      <div className="psi-enter-1 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="psi-card px-5 py-4">
          <div className="text-[12.5px] font-medium text-[var(--ink-muted)]">Series in dataset</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-[28px] font-medium leading-none tracking-[-0.03em] text-[var(--ink)] tabular-nums">
              {isFiltered ? filtered.length : totalSeries}
            </span>
            {isFiltered && (
              <span className="font-mono text-xs text-[var(--ink-muted)] tabular-nums">
                / {totalSeries}
              </span>
            )}
          </div>
        </div>

        <div className="psi-card px-5 py-4">
          <div className="text-[12.5px] font-medium text-[var(--ink-muted)]">Tests in total</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-[28px] font-medium leading-none tracking-[-0.03em] text-[var(--ink)] tabular-nums">
              {(isFiltered ? shownTests : totalTests).toLocaleString()}
            </span>
            {isFiltered && (
              <span className="font-mono text-xs text-[var(--ink-muted)] tabular-nums">
                / {totalTests.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="psi-card px-5 py-4">
          <div className="text-[12.5px] font-medium text-[var(--ink-muted)]">Series reaching 30% O₂</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-[28px] font-medium leading-none tracking-[-0.03em] text-[var(--amber)] tabular-nums">
              {isFiltered ? shownMoon : moonSeriesTotal}
            </span>
            {isFiltered && (
              <span className="font-mono text-xs text-[var(--ink-muted)] tabular-nums">
                / {moonSeriesTotal}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
