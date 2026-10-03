import { describe, it, expect } from "vitest";
import { parseListFilters } from "@/lib/list-filters";
import { STATUS_ORDER } from "@/lib/constants";

const SPEC = { status: STATUS_ORDER, assignee: null };

describe("parseListFilters", () => {
  it("콤마구분 값 → 배열(빈 조각은 버림)", () => {
    expect(parseListFilters({ assignee: "a,,b," }, SPEC)).toEqual({
      status: [],
      assignee: ["a", "b"],
      hasFilter: true,
    });
  });

  it("화이트리스트에 없는 enum 값은 버린다(prisma 에러 방지)", () => {
    expect(parseListFilters({ status: "foo,DONE" }, SPEC).status).toEqual([
      "DONE",
    ]);
    const r = parseListFilters({ status: "foo" }, SPEC);
    expect(r.status).toEqual([]);
    // 유효한 값이 하나도 안 남으면 필터 없음과 같다.
    expect(r.hasFilter).toBe(false);
  });

  it("파라미터가 없으면 전부 빈 배열 + hasFilter=false", () => {
    expect(parseListFilters({}, SPEC)).toEqual({
      status: [],
      assignee: [],
      hasFilter: false,
    });
  });
});
