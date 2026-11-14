import { Moon, PanelLeftClose, Sun } from "lucide-react";
import type { LiveStreamState, TextStreamBuffer } from "../../hooks/useAgentChat";
import type { ChatMessage, ModelInfo } from "../../types/agent";
import type { FilterState } from "../../types/psi";
import { AgentTab } from "./AgentTab";
import { FiltersTab } from "./FiltersTab";

interface SidebarProps {
  activeTab: "filters" | "ai";
  onTabChange: (tab: "filters" | "ai") => void;
  collapsed: boolean;
  onCollapse: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  filteredCount: number;
  totalCount: number;
  filters: FilterState;
  maxTests: number;
  onFiltersChange: (next: FilterState) => void;
  onResetFilters: () => void;
  agent: {
    configured: boolean;
    models: ModelInfo[];
    selectedModel: string;
    selectedEffort: string;
    availableEfforts: string[];
    handleModelChange: (id: string) => void;
    setSelectedEffort: (effort: string) => void;
    messages: ChatMessage[];
    live: LiveStreamState | null;
    textBufferRef: React.MutableRefObject<TextStreamBuffer>;
    notifyTextDrained: () => void;
    limitReached: boolean;
    toast: string | null;
    sendMessage: (q: string) => void;
    stopStreaming: () => void;
    clearHistory: () => void;
    rateMessage: (msgId: string, requestId: string, rating: "up" | "down") => void;
  };
}

export function Sidebar({
  activeTab,
  onTabChange,
  collapsed,
  onCollapse,
  isDark,
  onToggleTheme,
  filteredCount,
  totalCount,
  filters,
  maxTests,
  onFiltersChange,
  onResetFilters,
  agent,
}: SidebarProps) {
  if (collapsed) return null;

  const widthClass = activeTab === "ai" ? "w-[460px] max-w-[92vw]" : "w-[320px] max-w-[90vw]";

  return (
    <aside
      className={`${widthClass} shrink-0 h-screen flex flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] overflow-hidden transition-[width] duration-200`}
    >
      <div className="shrink-0 border-b border-[var(--border)] px-3.5 pt-3 pb-2.5">
        <div className="flex items-center justify-between gap-2 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-[13.5px] font-medium tracking-[-0.01em] text-[var(--ink)]">
              Explore PSI
            </span>
            <span className="rounded-md bg-[var(--bg-card)] border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-[var(--ink-muted)] tabular-nums whitespace-nowrap">
              {filteredCount}/{totalCount}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              title={isDark ? "Light theme" : "Dark theme"}
              className="psi-btn rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--ink)]"
            >
              {isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Collapse sidebar"
              className="psi-btn rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--ink)]"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-0.5">
          <button
            type="button"
            onClick={() => onTabChange("filters")}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
              activeTab === "filters"
                ? "bg-[var(--bg-card)] text-[var(--ink)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            Filters
          </button>
          <button
            type="button"
            onClick={() => onTabChange("ai")}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
              activeTab === "ai"
                ? "bg-[var(--bg-card)] text-[var(--ink)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            AI Agent
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === "filters" ? (
          <FiltersTab
            filters={filters}
            maxTests={maxTests}
            onChange={onFiltersChange}
            onReset={onResetFilters}
          />
        ) : (
          <AgentTab
            configured={agent.configured}
            models={agent.models}
            selectedModel={agent.selectedModel}
            selectedEffort={agent.selectedEffort}
            availableEfforts={agent.availableEfforts}
            onModelChange={agent.handleModelChange}
            onEffortChange={agent.setSelectedEffort}
            messages={agent.messages}
            live={agent.live}
            textBufferRef={agent.textBufferRef}
            onTextDrained={agent.notifyTextDrained}
            limitReached={agent.limitReached}
            toast={agent.toast}
            onSend={agent.sendMessage}
            onStop={agent.stopStreaming}
            onClear={agent.clearHistory}
            onRate={agent.rateMessage}
          />
        )}
      </div>
    </aside>
  );
}
