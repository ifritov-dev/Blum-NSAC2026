interface StatusBadgeProps {
  label: string;
}

export function StatusBadge({ label }: StatusBadgeProps) {
  if (label === "Present" || label === "Yes") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--action)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--action)]" />
        {label}
      </span>
    );
  }
  if (label.startsWith("Partial")) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--amber)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--amber)]" />
        {label}
      </span>
    );
  }
  if (label === "Missing" || label === "No") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--danger)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
        {label}
      </span>
    );
  }
  return (
    <span className="text-[11.5px] font-medium text-[var(--ink-muted)]">
      {label}
    </span>
  );
}
