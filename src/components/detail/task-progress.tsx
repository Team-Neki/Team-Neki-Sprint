import { STATUS_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  progressPercent,
  progressTotal,
  type TaskProgress,
} from "@/lib/task-progress";

/**
 * 완료(emerald)·진행 중(amber) 구간을 채운 막대. 남는 트랙이 할 일이다.
 * 트랙은 hairline(#ebebeb) — canvas(#fafafa)·카드(#ffffff) 어디서든 보이도록.
 * total > 0 일 때만 렌더한다.
 */
function ProgressBar({
  progress,
  className,
}: {
  progress: TaskProgress;
  className?: string;
}) {
  const total = progressTotal(progress);
  const pct = progressPercent(progress) ?? 0;
  const width = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={`진행률 ${pct}%`}
      className={cn(
        "bg-border flex h-1.5 shrink-0 overflow-hidden rounded-full",
        className,
      )}
    >
      <div
        className={STATUS_META.DONE.dot}
        style={{ width: width(progress.DONE) }}
      />
      <div
        className={STATUS_META.IN_PROGRESS.dot}
        style={{ width: width(progress.IN_PROGRESS) }}
      />
    </div>
  );
}

/**
 * 상세의 하위 목록 헤더와 표 사이에 두는 진행 요약(BACKEND-160).
 * 에픽·프로젝트·스프린트 모두 최하위 태스크까지 롤업한 개수라 "태스크 N개 중" 으로 기준을 밝힌다.
 */
export function TaskProgressSummary({ progress }: { progress: TaskProgress }) {
  const total = progressTotal(progress);
  if (total === 0) {
    return <p className="text-muted-foreground mb-3 text-xs">태스크 없음</p>;
  }
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <ProgressBar progress={progress} className="w-32 sm:w-48" />
      <span className="font-medium tabular-nums">
        {progressPercent(progress)}%
      </span>
      <span className="text-muted-foreground tabular-nums">
        태스크 {total}개 중 {STATUS_META.DONE.label} {progress.DONE} ·{" "}
        {STATUS_META.IN_PROGRESS.label} {progress.IN_PROGRESS} ·{" "}
        {STATUS_META.TODO.label} {progress.TODO}
      </span>
    </div>
  );
}

/** 표 셀: 작은 막대 + 완료/전체. 태스크가 없으면 "—". */
export function TaskProgressCell({ progress }: { progress: TaskProgress }) {
  const total = progressTotal(progress);
  if (total === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  return (
    <span className="flex items-center gap-2">
      <ProgressBar progress={progress} className="w-14" />
      <span className="text-muted-foreground text-xs tabular-nums">
        {progress.DONE}/{total}
      </span>
    </span>
  );
}
