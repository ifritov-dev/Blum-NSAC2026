import type { SeriesSummary } from "../../types/psi";

interface CatalogSectionProps {
  series: SeriesSummary[];
  onSelectSeries: (id: number) => void;
}

export function CatalogSection({ series, onSelectSeries }: CatalogSectionProps) {
  return (
    <section className="psi-card space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-4">
        <h2 className="text-[18px] font-medium tracking-[-0.02em] text-[var(--ink)]">Series catalog</h2>
        <span className="text-[12.5px] text-[var(--ink-muted)]">Select a row to inspect records below</span>
      </div>

      <div className="psi-scroll max-h-[380px] overflow-auto rounded-xl border border-[var(--border)]">
        <table className="min-w-full border-collapse text-left text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-[var(--bg-subtle)] text-[11.5px] font-medium text-[var(--ink-muted)]">
            <tr>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5">Series</th>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5">PSI</th>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5 text-right">Tests</th>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5 text-right">O₂ min</th>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5 text-right">O₂ max</th>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5">O₂ column</th>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5">Note</th>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5 text-right">Cols</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {series.map((t) => (
              <tr
                key={t.id}
                onClick={() => onSelectSeries(t.id)}
                className="cursor-pointer transition-colors hover:bg-[var(--action-soft)]"
              >
                <td className="px-3.5 py-2.5 font-medium text-[var(--ink)] whitespace-nowrap">
                  {t.series} <span className="font-mono text-[11px] text-[var(--ink-muted)]">#{t.id}</span>
                </td>
                <td className="px-3.5 py-2.5 font-mono text-[11.5px] text-[var(--ink-muted)] whitespace-nowrap">
                  {t.psi_accession}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono text-[var(--ink-secondary)] tabular-nums">
                  {t.row_count}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono text-[var(--ink-secondary)] tabular-nums">
                  {t.o2.min !== null ? `${t.o2.min.toFixed(1)}%` : "—"}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono text-[var(--ink-secondary)] tabular-nums">
                  {t.o2.max !== null ? `${t.o2.max.toFixed(1)}%` : "—"}
                </td>
                <td className="max-w-[180px] truncate px-3.5 py-2.5 text-[var(--ink-secondary)]" title={t.o2.cols.join(", ")}>
                  {t.o2.cols.join(", ") || "none"}
                </td>
                <td className="max-w-[210px] truncate px-3.5 py-2.5 text-[var(--ink-muted)]" title={t.o2.note}>
                  {t.o2.note || "—"}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono text-[var(--ink-secondary)] tabular-nums">
                  {t.columns.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
