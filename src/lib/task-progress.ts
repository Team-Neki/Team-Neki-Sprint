import type { Status } from "@prisma/client";

/** 상태별 태스크 개수. 에픽·프로젝트·스프린트의 하위 태스크 진행률 롤업(BACKEND-160). */
export type TaskProgress = Record<Status, number>;

export const EMPTY_PROGRESS: TaskProgress = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };

export function countStatuses(items: { status: Status }[]): TaskProgress {
  const p = { ...EMPTY_PROGRESS };
  for (const { status } of items) p[status] += 1;
  return p;
}

export function sumProgress(list: TaskProgress[]): TaskProgress {
  const p = { ...EMPTY_PROGRESS };
  for (const x of list) {
    p.TODO += x.TODO;
    p.IN_PROGRESS += x.IN_PROGRESS;
    p.DONE += x.DONE;
  }
  return p;
}

export const progressTotal = (p: TaskProgress) =>
  p.TODO + p.IN_PROGRESS + p.DONE;

/**
 * 완료 비율(%). 내림이라 모두 완료일 때만 100 이 된다(반올림하면 199/200 이 100% 로 보임).
 * 진행 중은 포함하지 않는다. 0건이면 null.
 */
export function progressPercent(p: TaskProgress): number | null {
  const total = progressTotal(p);
  return total === 0 ? null : Math.floor((p.DONE * 100) / total);
}
