import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownBlockProps {
  content: string;
  variant?: "message" | "thinking";
  className?: string;
}

export function MarkdownBlock({
  content,
  variant = "message",
  className = "",
}: MarkdownBlockProps) {
  const baseClass = variant === "thinking" ? "md-thinking" : "md-message";
  return (
    <div className={`${baseClass} ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
