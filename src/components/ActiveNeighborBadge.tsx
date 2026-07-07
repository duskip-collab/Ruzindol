import { CheckCircle2 } from "lucide-react";

export function ActiveNeighborBadge({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20 ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } font-semibold ${className}`}
      title="Overený sused"
    >
      <CheckCircle2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      Aktívny sused
    </span>
  );
}
