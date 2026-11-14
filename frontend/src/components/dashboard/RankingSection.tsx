import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { GoalOption, RankingRow } from "../../types/psi";

interface RankingSectionProps {
  goals: GoalOption[];
  rankings: Record<string, RankingRow[]>;
  filteredIds: Set<number>;
}

export function RankingSection({ goals, rankings, filteredIds }: RankingSectionProps) {
  const [goalId, setGoalId] = useState(goals[0]?.id || "lunar");
  const [hwOpen, setHwOpen] = useState(false);

  const rows = (rankings[goalId] || []).filter((r) => filteredIds.has(r.table_id));

  return (
    <section className="psi-card space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <h2 className="text-[18px] font-medium tracking-[-0.02em] text-[var(--ink)]">
            Rank series by fire-safety goal
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--ink-muted)]">
            Weighted relevance score across oxygen range, parameter completeness, and hardware role
          </p>
        </div>

        <select
          value={goalId}
          onChange={(e) => setGoalId(e.target.value)}
          aria-label="Exploration and safety scenario"
          className="w-full sm:w-auto max-w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] outline-none focus:border-[var(--action)]"
        >
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <div className="psi-scroll max-h-[380px] overflow-auto rounded-xl border border-[var(--border)]">
        <table className="min-w-full border-collapse text-left text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-[var(--bg-subtle)] text-[11.5px] font-medium text-[var(--ink-muted)]">
            <tr>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5">Score</th>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5">Series</th>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5">PSI</th>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5">Hardware</th>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5">Focus</th>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5 text-right">Tests</th>
              <th className="border-b border-[var(--border)] px-3.5 py-2.5">Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((r) => (
              <tr key={r.table_id} className="transition-colors hover:bg-[var(--bg-subtle)]/70">
                <td className="px-3.5 py-2.5">
                  <span
                    className={`inline-flex min-w-[34px] justify-center rounded-md px-1.5 py-0.5 font-mono text-[11.5px] font-medium tabular-nums ${
                      r.score >= 75
                        ? "bg-[var(--action-soft)] text-[var(--action)]"
                        : r.score >= 45
                          ? "bg-[var(--amber-soft)] text-[var(--amber)]"
                          : "bg-[var(--bg-subtle)] text-[var(--ink-muted)]"
                    }`}
                  >
                    {r.score}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 font-medium text-[var(--ink)] whitespace-nowrap">{r.series}</td>
                <td className="px-3.5 py-2.5 font-mono text-[11.5px] text-[var(--ink-muted)] whitespace-nowrap">{r.psi}</td>
                <td className="px-3.5 py-2.5 text-[var(--ink-secondary)] whitespace-nowrap">{r.hardware}</td>
                <td className="px-3.5 py-2.5 text-[var(--ink-secondary)]">{r.focus}</td>
                <td className="px-3.5 py-2.5 text-right font-mono text-[var(--ink-secondary)] tabular-nums">{r.tests}</td>
                <td className="px-3.5 py-2.5 text-[var(--ink-muted)]">{r.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]">
        <button
          type="button"
          onClick={() => setHwOpen((p) => !p)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink)]"
        >
          <span>Hardware context & Earth applications</span>
          {hwOpen ? <ChevronDown className="h-4 w-4 text-[var(--ink-muted)]" /> : <ChevronRight className="h-4 w-4 text-[var(--ink-muted)]" />}
        </button>
        {hwOpen && (
          <ul className="list-disc space-y-1.5 border-t border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 pl-8 text-[12.5px] leading-relaxed text-[var(--ink-secondary)] [&_code]:rounded [&_code]:bg-[var(--bg-subtle)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[11.5px]">
            <li>
              <strong className="text-[var(--ink)]">CIR / ACME</strong> (<code>ACME / BRE</code>, <code>CLD Flame</code>, <code>E-FIELD Flames</code>,{" "}
              <code>Flame Design</code>, <code>s-Flame</code>, <code>CFI-G</code>): gaseous flames in the Combustion Integrated Rack;{" "}
              <code>E-FIELD Flames</code> uses electric fields to mimic partial gravity, and <code>CFI-G</code> reaches up to 85% O₂.
            </li>
            <li>
              <strong className="text-[var(--ink)]">CIR / MDCA</strong> (<code>FLEX</code>, <code>FLEX-2</code>, <code>CFI</code>): liquid fuel droplets;{" "}
              <code>FLEX</code> tests atmosphere dilution with CO₂ and He.
            </li>
            <li>
              <strong className="text-[var(--ink)]">MSG</strong> (<code>BASS</code>, <code>BASS-II</code>, <code>SPICE</code>, <code>SLICE</code>) &{" "}
              <code>SAFFIRE-1/-2/-3</code>: solid materials (fabrics, PMMA) and co-flow flames.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Earth spin-offs</strong>: fine-water-mist extinguishers from ISS research, improved terrestrial smoke detectors (
              <code>SAME</code>/<code>SAME-R</code>), and protective firefighter gear.
            </li>
          </ul>
        )}
      </div>
    </section>
  );
}
