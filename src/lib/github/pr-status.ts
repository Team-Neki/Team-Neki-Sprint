import type { Status } from "@prisma/client";

export type PrOutcome = {
  prState: "OPEN" | "CLOSED" | "MERGED";
  taskStatus: Status | null;
};

/**
 * pull_request webhook action + merged 여부 -> PR 표시 상태 & 태스크 자동 전이 대상.
 * opened/reopened/ready_for_review -> OPEN + IN_PROGRESS.
 * closed & merged -> MERGED + DONE. closed & !merged -> CLOSED + 변경 없음.
 * 그 외 action -> null(무시).
 */
export function prEventToStatus(
  action: string,
  merged: boolean,
): PrOutcome | null {
  switch (action) {
    case "opened":
    case "reopened":
    case "ready_for_review":
      return { prState: "OPEN", taskStatus: "IN_PROGRESS" };
    case "closed":
      return merged
        ? { prState: "MERGED", taskStatus: "DONE" }
        : { prState: "CLOSED", taskStatus: null };
    default:
      return null;
  }
}
