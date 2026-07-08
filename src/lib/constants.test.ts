import { describe, it, expect } from "vitest";
import { formatIssueKey } from "@/lib/constants";

// 순수 포맷터: 팀 key 접두어 + 번호. team 없으면 #번호 fallback.
describe("formatIssueKey", () => {
  it("teamKey 있으면 KEY-번호", () => {
    expect(formatIssueKey("DESIGN", 1)).toBe("DESIGN-1");
    expect(formatIssueKey("ABC", 42)).toBe("ABC-42");
  });

  it("teamKey null/undefined/빈 문자열 → #번호 fallback", () => {
    expect(formatIssueKey(null, 7)).toBe("#7");
    expect(formatIssueKey(undefined, 7)).toBe("#7");
    expect(formatIssueKey("", 7)).toBe("#7");
  });
});
