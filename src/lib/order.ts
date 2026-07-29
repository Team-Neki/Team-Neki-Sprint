import type { Prisma, Status, SprintStatus } from "@prisma/client";

/**
 * 목록(PLP·상세 하위목록) 기본 정렬의 **DB 2차 키**: 종료일 가까운 순(미설정은 맨 뒤)
 * → 최신 생성 → id(동점 tiebreaker).
 *
 * 상태 순서(진행중→할 일→완료)는 enum 정의 순서로 DB 에서 낼 수 없으므로, 이 상수를
 * 쓰는 조회는 **결과에 반드시 `orderByDefaultStatus`(스프린트는 `orderBySprintStatus`)를
 * 적용**해야 한다. 규칙을 바꿀 땐 이 파일만 고친다 — 개별 쿼리에 배열을 직접 쓰면
 * 일부 쿼리만 옛 규칙으로 남는 누락이 생긴다(에픽 목록에서 실제로 발생, BACKEND-19).
 */
const LIST_ORDER_BY_DUE_DATE = [
  { dueDate: { sort: "asc", nulls: "last" } },
  { createdAt: "desc" },
  { id: "asc" },
] as const;

export const TASK_LIST_ORDER: Prisma.TaskOrderByWithRelationInput[] = [
  ...LIST_ORDER_BY_DUE_DATE,
];
export const EPIC_LIST_ORDER: Prisma.EpicOrderByWithRelationInput[] = [
  ...LIST_ORDER_BY_DUE_DATE,
];
export const PROJECT_LIST_ORDER: Prisma.ProjectOrderByWithRelationInput[] = [
  ...LIST_ORDER_BY_DUE_DATE,
];

/** 스프린트는 종료일 필드명이 `endDate`(우선순위 필드도 없음). 재배치는 orderBySprintStatus. */
export const SPRINT_LIST_ORDER: Prisma.SprintOrderByWithRelationInput[] = [
  { endDate: { sort: "asc", nulls: "last" } },
  { createdAt: "desc" },
  { id: "asc" },
];

/**
 * 목록(PLP·상세 하위목록) 기본 정렬의 상태 우선순위: 진행중 → 할 일 → 완료.
 * Status enum 의 정의 순서는 TODO→IN_PROGRESS→DONE 라 Prisma `orderBy`(asc/desc)로는
 * 이 순서를 낼 수 없다 → 종료일·생성일 은 DB 에서 정렬하고 상태만 인메모리로 재배치한다.
 */
const STATUS_RANK: Record<Status, number> = {
  IN_PROGRESS: 0,
  TODO: 1,
  DONE: 2,
};

/** 스프린트 상태(우선순위 필드 없음): 진행(ACTIVE) → 예정(PLANNED) → 완료(DONE). */
const SPRINT_STATUS_RANK: Record<SprintStatus, number> = {
  ACTIVE: 0,
  PLANNED: 1,
  DONE: 2,
};

/**
 * 이미 2차 키(종료일 가까운 순 → 생성일 desc → id)로 정렬된 배열을 상태 순서로만
 * **안정(stable)** 재정렬한다. JS sort 는 안정 정렬이므로 같은 상태 안에선 입력 순서
 * (=DB 정렬)가 유지된다. 결과: 진행중 → 할 일 → 완료, 각 그룹 내 종료일·생성일 순.
 */
export function orderByDefaultStatus<T extends { status: Status }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
}

/** 스프린트용 상태 안정 재정렬(진행→예정→완료). 2차 키는 호출부의 DB 정렬을 따른다. */
export function orderBySprintStatus<T extends { status: SprintStatus }>(
  rows: T[],
): T[] {
  return [...rows].sort(
    (a, b) => SPRINT_STATUS_RANK[a.status] - SPRINT_STATUS_RANK[b.status],
  );
}
