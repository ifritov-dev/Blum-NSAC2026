import { useState } from "react";
import type { SeriesSummary } from "../../types/psi";

interface CompareSectionProps {
  series: SeriesSummary[];
  paramOrder: string[];
}

export function CompareSection({ series, paramOrder }: CompareSectionProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleSeries = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const selected = selectedIds
    .map((id) => series.find((s) => s.id === id))
    .filter((s): s is SeriesSummary => Boolean(s));

  const commonCols =
    selected.length >= 2
      ? Array.from(
          selected.slice(1).reduce((acc, s) => {
            const next = new Set(s.columns);
            return new Set([...acc].filter((c) => next.has(c)));
          }, new Set(selected[0].columns)),
        ).sort()
      : [];

  const comparisonRows =
    selected.length >= 2
      ? [
          { label: "Tests", values: selected.map((s) => String(s.row_count)) },
          {
            label: "O₂, %",
            values: selected.map((s) =>
              s.o2.min === null || s.o2.max === null
                ? "not in table"
                : `${s.o2.min.toFixed(1)}–${s.o2.max.toFixed(1)}`,
            ),
          },
          ...paramOrder
            .filter((p) => p !== "O₂")
            .map((p) => ({
              label: p,
              values: selected.map((s) => s.coverage[p]?.label || "Missing"),
            })),
        ]
      : [];

  return (
    <section className="psi-card space-y-5 p-4 sm:p-6">
      <div className="border-b border-[var(--border)] pb-4">
        <h2 className="text-[18px] font-medium tracking-[-0.02em] text-[var(--ink)]">Compare series</h2>
        <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
          Pick 2–3 series below. Rows highlighted in amber indicate parameter differences.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {series.map((s) => {
          const active = selectedIds.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSeries(s.id)}
              className={`psi-btn rounded-lg border px-2.5 py-1 text-[12px] font-medium ${
                active
                  ? "border-[var(--action)] bg-[var(--action)] text-white"
                  : "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--ink-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
              }`}
            >
              {s.series} <span className={active ? "opacity-80" : "text-[var(--ink-muted)]"}>#{s.id}</span>
            </button>
          );
        })}
      </div>

      {selected.length >= 2 ? (
        <div className="space-y-4">
          <div className="psi-scroll overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-full border-collapse text-left text-[12.5px]">
              <thead className="bg-[var(--bg-subtle)] text-[11.5px] font-medium text-[var(--ink-muted)]">
                <tr>
                  <th className="border-b border-[var(--border)] px-3.5 py-2.5">Parameter</th>
                  {selected.map((s) => (
                    <th key={s.id} className="border-b border-[var(--border)] px-3.5 py-2.5 whitespace-nowrap">
                      {s.series} · {s.psi_accession} · #{s.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {comparisonRows.map((row) => {
                  const differs = new Set(row.values).size > 1;
                  return (
                    <tr key={row.label} className={differs ? "bg-[var(--amber-soft)]" : ""}>
                      <td className="px-3.5 py-2.5 font-medium text-[var(--ink)]">{row.label}</td>
                      {row.values.map((val, idx) => (
                        <td key={idx} className="px-3.5 py-2.5 text-[var(--ink-secondary)]">
                          {val}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
              <div className="text-[12px] font-medium text-[var(--ink)]">Shared columns</div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-muted)]">
                {commonCols.join(", ") || "none"}
              </p>
            </div>
            <div className="space-y-2">
              {selected.map((s) => {
                const only = s.columns.filter((c) => !commonCols.includes(c));
                return (
                  <div key={s.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
                    <div className="text-[12px] font-medium text-[var(--ink)]">
                      Only in {s.series} #{s.id}
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-muted)]">
                      {only.join(", ") || "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-[var(--bg-subtle)] px-4 py-3 text-xs text-[var(--ink-muted)]">
          Pick at least 2 series above to compare their schema and parameters.
        </div>
      )}
    </section>
  );
}
