import { X } from "lucide-react";
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

/**
 * 라벨 배지(C8). in-product 데이터 태그라 컬러 pill 허용(DESIGN.md 예외).
 * 새 chrome 액센트를 도입하지 않기 위해, 라벨 color 를 화이트에 옅게 섞은
 * 틴트 배경 + 같은 color 를 잉크에 섞어 어둡게 한 텍스트/보더로 라이트 테마에서
 * 대비를 확보한다(원색 그대로 채우지 않음).
 */
export function LabelBadge({
  name,
  color,
  className,
  onRemove,
}: {
  name: string;
  color: string;
  className?: string;
  onRemove?: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        color: `color-mix(in oklch, ${color} 70%, var(--foreground))`,
        borderColor: `color-mix(in oklch, ${color} 30%, transparent)`,
        backgroundColor: `color-mix(in oklch, ${color} 14%, var(--card))`,
      }}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${name} 라벨 제거`}
          className="-mr-0.5 rounded-full opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      )}
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
