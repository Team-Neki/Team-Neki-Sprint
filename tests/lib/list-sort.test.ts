import { describe, it, expect } from "vitest";
import { parseListSort } from "@/lib/list-sort";

const ALLOWED = ["title", "status", "dueDate"] as const;

describe("parseListSort", () => {
  it("허용 필드 + dir=asc → 그대로", () => {
    expect(parseListSort({ sort: "title", dir: "asc" }, ALLOWED)).toEqual({
      field: "title",
      dir: "asc",
    });
  });

  it("dir 이 asc 가 아니면 desc(미지정·오타 포함)", () => {
    expect(parseListSort({ sort: "status", dir: "desc" }, ALLOWED)?.dir).toBe("desc");
    expect(parseListSort({ sort: "status" }, ALLOWED)?.dir).toBe("desc");
    expect(parseListSort({ sort: "status", dir: "weird" }, ALLOWED)?.dir).toBe("desc");
  });

  it("허용 목록에 없는 필드는 무시 → 기본 정렬 유지", () => {
    // 임의 문자열이 prisma orderBy 키로 새는 것을 막는 방어선.
    expect(parseListSort({ sort: "password", dir: "asc" }, ALLOWED)).toBeUndefined();
  });

  it("sort 없으면 undefined", () => {
    expect(parseListSort({}, ALLOWED)).toBeUndefined();
    expect(parseListSort({ dir: "asc" }, ALLOWED)).toBeUndefined();
  });
});
