import type { Status, Priority, SprintStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { STATUS_META, PRIORITY_META, SPRINT_STATUS_META } from "@/lib/constants";

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <span className={cn("text-xs font-medium", meta.color, className)}>
      {meta.label}
    </span>
  );
}

export function SprintStatusBadge({
  status,
  className,
}: {
  status: SprintStatus;
  className?: string;
}) {
  const meta = SPRINT_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}
