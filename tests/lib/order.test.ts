import { describe, it, expect } from "vitest";
import {
  orderByDefaultStatus,
  orderBySprintStatus,
  TASK_LIST_ORDER,
  EPIC_LIST_ORDER,
  PROJECT_LIST_ORDER,
  SPRINT_LIST_ORDER,
} from "@/lib/order";

describe("orderByDefaultStatus", () => {
  it("진행중 → 할 일 → 완료 순으로 재배치한다", () => {
    const rows = [
      { id: "a", status: "DONE" as const },
      { id: "b", status: "TODO" as const },
      { id: "c", status: "IN_PROGRESS" as const },
    ];
    expect(orderByDefaultStatus(rows).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("같은 상태 안에선 입력(=DB 정렬) 순서를 유지한다(안정 정렬)", () => {
    const rows = [
      { id: "1", status: "TODO" as const },
      { id: "2", status: "IN_PROGRESS" as const },
      { id: "3", status: "TODO" as const },
      { id: "4", status: "IN_PROGRESS" as const },
    ];
    // IN_PROGRESS 먼저(입력 순 2,4), 그다음 TODO(입력 순 1,3).
    expect(orderByDefaultStatus(rows).map((r) => r.id)).toEqual([
      "2",
      "4",
      "1",
      "3",
    ]);
  });

  it("원본 배열을 변형하지 않는다", () => {
    const rows = [
      { id: "a", status: "DONE" as const },
      { id: "b", status: "IN_PROGRESS" as const },
    ];
    orderByDefaultStatus(rows);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("orderBySprintStatus", () => {
  it("진행(ACTIVE) → 예정(PLANNED) → 완료(DONE) 순으로 재배치한다", () => {
    const rows = [
      { id: "a", status: "DONE" as const },
      { id: "b", status: "PLANNED" as const },
      { id: "c", status: "ACTIVE" as const },
    ];
    expect(orderBySprintStatus(rows).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
});

// 목록 정렬 상수: 엔티티별로 따로 export 하지만 규칙은 하나여야 한다.
// 한쪽만 고쳐 목록마다 순서가 달라지는 회귀(에픽 목록에서 실제 발생)를 막는다.
describe("목록 정렬 상수", () => {
  it("태스크·에픽·프로젝트는 동일한 2차 키를 쓴다", () => {
    expect(EPIC_LIST_ORDER).toEqual(TASK_LIST_ORDER);
    expect(PROJECT_LIST_ORDER).toEqual(TASK_LIST_ORDER);
  });

  it("종료일 asc(미설정 맨 뒤) → 생성일 desc → id 순이다", () => {
    expect(TASK_LIST_ORDER).toEqual([
      { dueDate: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
      { id: "asc" },
    ]);
  });

  it("스프린트는 종료일 필드명만 endDate 로 다르다", () => {
    expect(SPRINT_LIST_ORDER).toEqual([
      { endDate: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
      { id: "asc" },
    ]);
  });
});
