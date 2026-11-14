import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { ChatMessage } from "../../types/agent";
import { MarkdownBlock } from "../common/MarkdownBlock";
import { AgentTrace } from "./AgentTrace";

interface AgentMessageProps {
  message: ChatMessage;
  onRate: (msgId: string, requestId: string, rating: "up" | "down") => void;
}

export function AgentMessage({ message, onRate }: AgentMessageProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-br-sm border border-[var(--border)] bg-[var(--action-soft)] px-3.5 py-2 text-[13px] leading-relaxed text-[var(--ink)] break-words">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-1.5">
      <AgentTrace
        steps={message.steps}
        thinking={message.thinking}
        durationS={message.duration_s}
      />

      <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-2.5">
        <MarkdownBlock content={message.text} variant="message" />

        {message.request_id && (
          <div className="mt-2.5 flex items-center gap-1 border-t border-[var(--border)] pt-2">
            <button
              type="button"
              aria-label="Thumbs up"
              onClick={() => onRate(message.id, message.request_id!, "up")}
              className={`rounded-md p-1 transition-colors ${
                message.feedback === "up"
                  ? "bg-[var(--action-soft)] text-[var(--action)]"
                  : "text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
              }`}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Thumbs down"
              onClick={() => onRate(message.id, message.request_id!, "down")}
              className={`rounded-md p-1 transition-colors ${
                message.feedback === "down"
                  ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                  : "text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
              }`}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
