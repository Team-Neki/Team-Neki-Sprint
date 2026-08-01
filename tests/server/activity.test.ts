import { describe, it, expect, vi } from "vitest";

// diffFields 는 순수 함수지만 같은 모듈이 prisma 를 import 한다(logActivity).
// 테스트는 DB 를 안 쓰므로 prisma 를 빈 객체로 목킹하고 동적 import 로 불러온다.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const { diffFields } = await import("@/server/activity");

describe("diffFields", () => {
  it("returns only changed fields in both changes and data", () => {
    const { changes, data } = diffFields(
      { title: "old", status: "TODO" },
      { title: "new", status: "TODO" },
    );
    expect(changes).toEqual([{ field: "title", from: "old", to: "new" }]);
    expect(data).toEqual({ title: "new" });
  });

  it("skips undefined patch keys (single-field inline edit safety)", () => {
    const { changes, data } = diffFields(
      { title: "a", priority: "LOW" },
      { title: "b", priority: undefined },
    );
    expect(changes.map((c) => c.field)).toEqual(["title"]);
    expect(data).toEqual({ title: "b" });
  });

  it("treats null and undefined-current as equal (no false change)", () => {
    const { changes } = diffFields({ ownerId: null }, { ownerId: null });
    expect(changes).toEqual([]);
  });

  it("normalizes Date to ISO in changes but keeps raw value in data", () => {
    const to = new Date("2026-07-09T00:00:00.000Z");
    const { changes, data } = diffFields({ dueDate: null }, { dueDate: to });
    expect(changes).toEqual([
      { field: "dueDate", from: null, to: "2026-07-09T00:00:00.000Z" },
    ]);
    expect(data.dueDate).toBe(to); // prisma 에 넘길 값은 원본 Date 유지
  });

  it("detects a value becoming null (cleared field)", () => {
    const { changes, data } = diffFields(
      { assigneeId: "u1" },
      { assigneeId: null },
    );
    expect(changes).toEqual([
      { field: "assigneeId", from: "u1", to: null },
    ]);
    expect(data).toEqual({ assigneeId: null });
  });
});
