import { describe, it, expect } from "vitest";
import { orderByDefaultStatus, orderBySprintStatus } from "./order";

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
