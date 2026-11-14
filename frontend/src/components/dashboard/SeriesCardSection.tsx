import { useEffect, useState } from "react";
import { fetchSeriesDetail } from "../../api/client";
import type { SeriesDetail, SeriesSummary } from "../../types/psi";

interface SeriesCardSectionProps {
  series: SeriesSummary[];
  selectedId: number;
  onSelectId: (id: number) => void;
}

export function SeriesCardSection({
  series,
  selectedId,
  onSelectId,
}: SeriesCardSectionProps) {
  const [detail, setDetail] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const activeId = series.some((s) => s.id === selectedId) ? selectedId : series[0]?.id;

  useEffect(() => {
    if (!activeId) return;
    let mounted = true;
    setLoading(true);
    fetchSeriesDetail(activeId)
      .then((d) => {
        if (mounted) setDetail(d);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeId]);

  if (!series.length) return null;

  return (
    <section className="psi-card space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <h2 className="text-[18px] font-medium tracking-[-0.02em] text-[var(--ink)]">Series card</h2>
        <select
          value={activeId}
          onChange={(e) => onSelectId(Number(e.target.value))}
          aria-label="Pick a series"
          className="max-w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] outline-none focus:border-[var(--action)]"
        >
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.series} · {s.psi_accession} · table #{s.id} ({s.row_count} tests)
            </option>
          ))}
        </select>
      </div>

      {loading || !detail ? (
        <div className="rounded-xl bg-[var(--bg-subtle)] px-4 py-6 text-center text-xs text-[var(--ink-muted)]">
          Loading records...
        </div>
      ) : (
        <div className="space-y-5">
          <div className="text-xs text-[var(--ink-muted)]">
            Source file:{" "}
            <code className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[var(--ink-secondary)]">
              {detail.source_file}
            </code>
          </div>

          <div className="psi-scroll max-h-[340px] overflow-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-full border-collapse text-left text-[12px]">
              <thead className="sticky top-0 z-10 bg-[var(--bg-subtle)] text-[11.5px] font-medium text-[var(--ink-muted)]">
                <tr>
                  {detail.columns.map((col) => (
                    <th key={col} className="border-b border-[var(--border)] px-3 py-2.5 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {detail.records.map((rec, idx) => (
                  <tr key={idx} className="transition-colors hover:bg-[var(--bg-subtle)]/70">
                    {detail.columns.map((col) => {
                      const val = rec[col];
                      return (
                        <td key={col} className="px-3 py-2 text-[var(--ink-secondary)] whitespace-nowrap">
                          {val === null || val === undefined || val === "" ? "—" : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="mb-2.5 text-[12.5px] font-medium text-[var(--ink-secondary)]">
              Data completeness by column{" "}
              <span className="font-normal text-[var(--ink-muted)]">(highlighted when under 100%)</span>
            </div>
            <div className="psi-scroll max-h-[260px] overflow-auto rounded-xl border border-[var(--border)]">
              <table className="min-w-full border-collapse text-left text-[12.5px]">
                <thead className="sticky top-0 bg-[var(--bg-subtle)] text-[11.5px] font-medium text-[var(--ink-muted)]">
                  <tr>
                    <th className="border-b border-[var(--border)] px-3.5 py-2">Column</th>
                    <th className="border-b border-[var(--border)] px-3.5 py-2 text-right">Filled, % of tests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {detail.column_completeness.map((item) => (
                    <tr
                      key={item.column}
                      className={item.filled_pct < 100 ? "bg-[var(--danger-soft)]" : ""}
                    >
                      <td className="px-3.5 py-2 font-medium text-[var(--ink)]">{item.column}</td>
                      <td className="px-3.5 py-2 text-right font-mono tabular-nums text-[var(--ink-secondary)]">
                        {item.filled_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
