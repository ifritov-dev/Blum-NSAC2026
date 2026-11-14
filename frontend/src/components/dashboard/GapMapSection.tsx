import { AlertTriangle, Download } from "lucide-react";
import { buildExportUrl } from "../../api/client";
import type { FilterState, SeriesSummary } from "../../types/psi";
import { StatusBadge } from "../common/StatusBadge";

interface GapMapSectionProps {
  series: SeriesSummary[];
  paramOrder: string[];
  filters: FilterState;
}

export function GapMapSection({ series, paramOrder, filters }: GapMapSectionProps) {
  const missingSummary = paramOrder
    .map((param) => {
      const missingSeries = series.filter((s) => s.coverage[param]?.share === 0);
      return {
        param,
        seriesWithout: missingSeries.length,
        testsAffected: missingSeries.reduce((acc, s) => acc + s.row_count, 0),
      };
    })
    .sort((a, b) => b.seriesWithout - a.seriesWithout);

  return (
    <section className="psi-card space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <h2 className="text-[18px] font-medium tracking-[-0.02em] text-[var(--ink)]">
            Gap map: parameter coverage
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
            Missing = absent from PSI table · Partial = filled in some rows · n/a = no oxygen column
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={buildExportUrl("xlsx", filters)}
            className="psi-btn inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:border-[var(--action)] hover:text-[var(--action)]"
          >
            <Download className="h-3.5 w-3.5" />
            Excel
          </a>
          <a
            href={buildExportUrl("csv", filters)}
            className="psi-btn inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:border-[var(--action)] hover:text-[var(--action)]"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </a>
        </div>
      </div>

      <div className="psi-scroll max-h-[430px] overflow-auto rounded-xl border border-[var(--border)]">
        <table className="min-w-full border-collapse text-left text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-[var(--bg-subtle)] text-[11.5px] font-medium text-[var(--ink-muted)]">
            <tr>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5 whitespace-nowrap">Series</th>
              <th className="border-b border-[var(--border)] px-3 py-2.5 text-right whitespace-nowrap">Tests</th>
              {paramOrder.map((p) => (
                <th key={p} className="border-b border-[var(--border)] px-3 py-2.5 whitespace-nowrap">
                  {p}
                </th>
              ))}
              <th className="border-b border-[var(--border)] px-3 py-2.5 whitespace-nowrap">O₂ ≥ 30%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {series.map((t) => {
              const hi = t.o2.max;
              const moon = hi === null ? "n/a" : hi >= 30 ? "Yes" : "No";
              return (
                <tr key={t.id} className="transition-colors hover:bg-[var(--bg-subtle)]/70">
                  <td className="px-3.5 py-2.5 font-medium text-[var(--ink)] whitespace-nowrap">
                    {t.series} <span className="font-mono text-[11px] text-[var(--ink-muted)]">#{t.id}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[var(--ink-secondary)] tabular-nums">
                    {t.row_count}
                  </td>
                  {paramOrder.map((p) => (
                    <td key={p} className="px-3 py-2.5 whitespace-nowrap">
                      <StatusBadge label={t.coverage[p]?.label || "Missing"} />
                    </td>
                  ))}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusBadge label={moon} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-2.5 text-[12.5px] font-medium text-[var(--ink-secondary)]">
          Parameters missing most often across series
        </h3>
        <div className="psi-scroll overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="min-w-full border-collapse text-left text-[12.5px]">
            <thead className="bg-[var(--bg-subtle)] text-[11.5px] font-medium text-[var(--ink-muted)]">
              <tr>
                <th className="border-b border-[var(--border)] px-3.5 py-2">Parameter</th>
                <th className="border-b border-[var(--border)] px-3.5 py-2 text-right">Series without it</th>
                <th className="border-b border-[var(--border)] px-3.5 py-2 text-right">Tests affected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {missingSummary.map((row) => (
                <tr key={row.param} className="transition-colors hover:bg-[var(--bg-subtle)]/60">
                  <td className="px-3.5 py-2 font-medium text-[var(--ink)]">{row.param}</td>
                  <td className="px-3.5 py-2 text-right font-mono text-[var(--ink-secondary)] tabular-nums">
                    {row.seriesWithout}
                  </td>
                  <td className="px-3.5 py-2 text-right font-mono text-[var(--ink-muted)] tabular-nums">
                    {row.testsAffected.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-[var(--amber)]/25 bg-[var(--amber-soft)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--ink)]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--amber)]" />
        <p>
          <strong>Partial gravity</strong> (Moon ≈0.16 g, Mars ≈0.38 g): per the NASA challenge description, PSI has no such data yet. It is expected from LUCI and FM2.
        </p>
      </div>
    </section>
  );
}
