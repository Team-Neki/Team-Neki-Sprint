import type { Status, Priority } from "@prisma/client";

export const STATUS_ORDER: Status[] = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

export const STATUS_META: Record<
  Status,
  { label: string; color: string; dot: string }
> = {
  BACKLOG: { label: "백로그", color: "text-neutral-500", dot: "bg-neutral-400" },
  TODO: { label: "할 일", color: "text-blue-600", dot: "bg-blue-500" },
  IN_PROGRESS: { label: "진행 중", color: "text-amber-600", dot: "bg-amber-500" },
  IN_REVIEW: { label: "리뷰", color: "text-violet-600", dot: "bg-violet-500" },
  DONE: { label: "완료", color: "text-emerald-600", dot: "bg-emerald-500" },
};

export const PRIORITY_ORDER: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string }
> = {
  URGENT: { label: "긴급", color: "text-red-600" },
  HIGH: { label: "높음", color: "text-orange-600" },
  MEDIUM: { label: "보통", color: "text-neutral-600" },
  LOW: { label: "낮음", color: "text-neutral-400" },
};

/**
 * 표시용 이슈 key. Epic·Task는 소유 팀의 key 접두어 + 팀 단위 연속 번호로 표기한다.
 * 예: formatIssueKey("DESIGN", 1) → "DESIGN-1".
 * team이 없는 경우(이론상 없음)는 번호만 fallback으로 보여준다.
 */
export function formatIssueKey(
  teamKey: string | null | undefined,
  number: number,
): string {
  return teamKey ? `${teamKey}-${number}` : `#${number}`;
}

export const SPRINT_STATUS_META: Record<
  "PLANNED" | "ACTIVE" | "DONE",
  { label: string; color: string; dot: string }
> = {
  PLANNED: { label: "예정", color: "text-neutral-500", dot: "bg-neutral-400" },
  ACTIVE: { label: "진행 중", color: "text-blue-600", dot: "bg-blue-500" },
  DONE: { label: "완료", color: "text-emerald-600", dot: "bg-emerald-500" },
};

export const SPRINT_STATUS_ORDER: ("PLANNED" | "ACTIVE" | "DONE")[] = [
  "PLANNED",
  "ACTIVE",
  "DONE",
];
