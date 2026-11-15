import type { ChatMessage } from "../../types/agent";
import { MarkdownBlock } from "../common/MarkdownBlock";
import { AgentTrace } from "./AgentTrace";

interface AgentMessageProps {
  message: ChatMessage;
}

export function AgentMessage({ message }: AgentMessageProps) {
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
      </div>
    </div>
  );
}
