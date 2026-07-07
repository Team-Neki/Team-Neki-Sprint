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

export const ISSUE_PREFIX = {
  initiative: "INI",
  epic: "EPIC",
  task: "TASK",
} as const;
