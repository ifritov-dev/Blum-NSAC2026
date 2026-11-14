import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesSummary } from "../../types/psi";

interface OxygenChartProps {
  series: SeriesSummary[];
  isDark: boolean;
}

interface ChartDatum {
  name: string;
  base: number;
  span: number;
  rawMin: number;
  rawMax: number;
  lunar: boolean;
}

export function OxygenChart({ series, isDark }: OxygenChartProps) {
  const withO2 = series.filter((s) => s.o2.min !== null && s.o2.max !== null);
  const noO2 = series.filter((s) => s.o2.min === null).map((s) => s.series);

  const chartData: ChartDatum[] = withO2.map((t) => {
    let lo = t.o2.min ?? 0;
    let hi = t.o2.max ?? 0;
    if (hi - lo < 1) {
      lo = Math.max(0, lo - 0.6);
      hi = Math.min(100, hi + 0.6);
    }
    return {
      name: `${t.series} #${t.id}`,
      base: Number(lo.toFixed(2)),
      span: Number((hi - lo).toFixed(2)),
      rawMin: Number((t.o2.min ?? 0).toFixed(1)),
      rawMax: Number((t.o2.max ?? 0).toFixed(1)),
      lunar: (t.o2.max ?? 0) >= 30,
    };
  });

  const moonCount = withO2.filter((t) => (t.o2.max ?? 0) >= 30).length;
  const gridColor = isDark ? "rgba(255,255,255,0.07)" : "rgba(20,22,25,0.08)";
  const tickColor = isDark ? "#848c99" : "#686e7a";
  const lunarBar = isDark ? "#f59e0b" : "#d97706";
  const stdBar = isDark ? "#4f8bff" : "#1a56db";

  return (
    <section className="psi-card psi-enter-2 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <h2 className="text-[17px] font-medium tracking-[-0.02em] text-[var(--ink)] sm:text-[18px]">
            Oxygen range by series
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--ink-muted)] sm:text-[13px]">
            Earth 21% O₂ (14.7 psi) · Lunar habitat 30%+ O₂ (≤10.2 psi) · Spacesuit 100% O₂ (4.3 psi)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[var(--ink-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: lunarBar }} />
            Reaches 30%+ O₂ (Moon)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: stdBar }} />
            Below 30% O₂
          </span>
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="mt-5">
          <div className="psi-scroll overflow-x-auto">
            <div className="h-[340px] min-w-[640px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 14, right: 14, left: 42, bottom: 64 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={gridColor} vertical={false} />
                  <ReferenceArea y1={30} y2={100} fill={lunarBar} fillOpacity={isDark ? 0.055 : 0.06} />
                  <ReferenceLine
                    y={30}
                    stroke={lunarBar}
                    strokeDasharray="4 4"
                    label={{
                      value: "Moon: 30%+",
                      position: "insideTopLeft",
                      fill: lunarBar,
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  />
                  <ReferenceLine
                    y={21}
                    stroke={isDark ? "#fb7185" : "#be123c"}
                    strokeDasharray="4 4"
                    label={{
                      value: "Earth: 21%",
                      position: "insideBottomRight",
                      fill: isDark ? "#fb7185" : "#be123c",
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={68}
                    tick={{ fill: tickColor, fontSize: 11 }}
                    axisLine={{ stroke: gridColor }}
                    tickLine={false}
                  />
                  <YAxis
                    width={42}
                    domain={[0, 100]}
                    tick={{ fill: tickColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: "O₂ %", angle: -90, position: "insideLeft", dx: -4, fill: tickColor, fontSize: 11 }}
                  />
                <Tooltip
                  cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(20,22,25,0.035)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0]?.payload as ChartDatum | undefined;
                    if (!item) return null;
                    return (
                      <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-card)] px-3 py-2 text-xs shadow-lg">
                        <div className="font-medium text-[var(--ink)]">{item.name}</div>
                        <div className="mt-0.5 font-mono text-[11.5px] text-[var(--ink-secondary)] tabular-nums">
                          O₂ range: {item.rawMin}–{item.rawMax}%
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="base" stackId="o2" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="span" stackId="o2" radius={[3, 3, 3, 3]} isAnimationActive={false}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.lunar ? lunarBar : stdBar} />
                  ))}
                </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-[var(--ink-secondary)]">
            <p>
              <span className="font-mono font-medium text-[var(--ink)]">{moonCount} of {withO2.length}</span>{" "}
              plotted series reach{" "}
              <span className="font-medium text-[var(--amber)]">30% O₂ or more</span>.
            </p>
            {noO2.length > 0 && (
              <p className="text-[12px] text-[var(--ink-muted)]">
                No O₂ column in PSI table: {noO2.join(", ")}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-[var(--bg-subtle)] px-4 py-3 text-xs text-[var(--ink-muted)]">
          No series with known O₂ under these filters.
        </div>
      )}
    </section>
  );
}
