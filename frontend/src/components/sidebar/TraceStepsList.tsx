import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { ActiveToolInfo, TraceStep } from "../../types/agent";

interface StepGroup {
  key: string;
  tool: string;
  title: string;
  subtitle: string;
  items: TraceStep[];
}

function parseReadSeries(label: string): string {
  const m = label.match(/\(#\d+\s*·\s*([^)]+)\)/);
  return m ? m[1].trim() : label.replace(/^Read\s+/i, "");
}

function groupSteps(steps: TraceStep[]): StepGroup[] {
  const groups: StepGroup[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const prev = groups[groups.length - 1];
    if (
      (step.tool === "inspect_psi_table" && prev?.tool === "inspect_psi_table") ||
      (step.tool === "search_psi_records" && prev?.tool === "search_psi_records")
    ) {
      prev.items.push(step);
      continue;
    }
    groups.push({ key: `${step.tool}-${i}`, tool: step.tool, title: step.label, subtitle: step.preview, items: [step] });
  }
  return groups.map((g) => {
    if (g.items.length <= 1) return g;
    if (g.tool === "inspect_psi_table") {
      const names = g.items.map((it) => parseReadSeries(it.label));
      const head = names.slice(0, 3).join(", ");
      const rest = names.length > 3 ? ` +${names.length - 3} more` : "";
      return { ...g, title: `Read ${g.items.length} PSI tables`, subtitle: `${head}${rest}` };
    }
    if (g.tool === "search_psi_records") {
      return {
        ...g,
        title: `Ran ${g.items.length} record searches`,
        subtitle: g.items.map((it) => it.label.replace(/^Search\s+/i, "")).slice(0, 2).join(" · "),
      };
    }
    return g;
  });
}

function StepDot({ tool, pulse }: { tool: string; pulse?: boolean }) {
  const color =
    tool === "inspect_psi_table"
      ? "bg-[var(--action)]"
      : tool === "search_psi_records"
        ? "bg-[var(--amber)]"
        : "bg-[var(--ink-muted)]";
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${color} ${pulse ? "animate-pulse" : ""}`} />;
}

export function TraceStepsList({
  steps,
  activeTools = [],
}: {
  steps: TraceStep[];
  activeTools?: ActiveToolInfo[];
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => groupSteps(steps), [steps]);

  const toggleGroup = (key: string) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  const toggleItem = (key: string) => setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div>
      {groups.map((group, idx) => {
        const isGroupOpen = Boolean(openGroups[group.key]);
        const isBatch = group.items.length > 1;
        const hasDetails = isBatch || Boolean(group.subtitle);

        return (
          <div key={group.key} className={idx > 0 ? "border-t border-[var(--border)]" : ""}>
            <button
              type="button"
              disabled={!hasDetails}
              onClick={() => hasDetails && toggleGroup(group.key)}
              className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-subtle)] disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="mt-1.5 flex items-center"><StepDot tool={group.tool} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1.5">
                  <span className="truncate text-[11.5px] font-medium text-[var(--ink)]">{group.title}</span>
                  {hasDetails && (
                    <span className="shrink-0 text-[var(--ink-muted)]">
                      {isGroupOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </span>
                  )}
                </span>
                {!isGroupOpen && group.subtitle && (
                  <span className="mt-0.5 block truncate text-[10.5px] text-[var(--ink-muted)]">{group.subtitle}</span>
                )}
              </span>
            </button>

            {isGroupOpen && (
              <div className="border-t border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 space-y-1.5">
                {isBatch ? (
                  group.items.map((item, subIdx) => {
                    const itemKey = `${group.key}-${subIdx}`;
                    const itemOpen = Boolean(openItems[itemKey]);
                    return (
                      <div key={itemKey} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5">
                        <button
                          type="button"
                          onClick={() => item.preview && toggleItem(itemKey)}
                          className="flex w-full items-center justify-between gap-1.5 text-left"
                        >
                          <span className="min-w-0 truncate text-[11px] font-medium text-[var(--ink)]">{item.label}</span>
                          {item.preview && (itemOpen ? <ChevronDown className="h-3 w-3 shrink-0 text-[var(--ink-muted)]" /> : <ChevronRight className="h-3 w-3 shrink-0 text-[var(--ink-muted)]" />)}
                        </button>
                        {itemOpen && item.preview && (
                          <div className="mt-1 border-t border-[var(--border)] pt-1 text-[10.5px] leading-relaxed text-[var(--ink-muted)] break-words">
                            {item.preview}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  group.subtitle && (
                    <div className="px-0.5 py-0.5 text-[11px] leading-relaxed text-[var(--ink-secondary)] break-words">
                      {group.subtitle}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}

      {activeTools.map((tool, i) => (
        <div
          key={tool.id || `${tool.name}-${i}`}
          className={`flex items-center gap-2.5 px-3 py-2 text-[11.5px] text-[var(--action)] ${
            groups.length > 0 || i > 0 ? "border-t border-[var(--border)]" : ""
          }`}
        >
          <StepDot tool={tool.name} pulse />
          <span className="truncate font-medium">{tool.label}</span>
        </div>
      ))}
    </div>
  );
}
