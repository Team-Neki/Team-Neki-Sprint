import { describe, it, expect } from "vitest";
import { canManage, assertCanManage } from "@/lib/authz";

const admin = { id: "admin", role: "ADMIN" as const };
const member = { id: "u1", role: "MEMBER" as const };

describe("canManage", () => {
  it("allows ADMIN regardless of ownership", () => {
    expect(canManage(admin, "someone-else")).toBe(true);
    expect(canManage(admin)).toBe(true);
  });

  it("allows a member who is one of the owners", () => {
    expect(canManage(member, "u1")).toBe(true);
    expect(canManage(member, "other", "u1")).toBe(true); // reporter or assignee
  });

  it("denies a member who owns nothing here", () => {
    expect(canManage(member, "other")).toBe(false);
    expect(canManage(member, null, undefined)).toBe(false);
    expect(canManage(member)).toBe(false);
  });
});

describe("assertCanManage", () => {
  it("throws for unauthorized member", () => {
    expect(() => assertCanManage(member, "태스크", "other")).toThrow(
      /권한이 없습니다/,
    );
  });
  it("does not throw for owner or admin", () => {
    expect(() => assertCanManage(member, "태스크", "u1")).not.toThrow();
    expect(() => assertCanManage(admin, "태스크", "other")).not.toThrow();
  });
});
