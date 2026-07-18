import { describe, it, expect } from "vitest";
import { parseIssueKey } from "./issue-key";

describe("parseIssueKey", () => {
  it("splits TEAM-123 into key and number", () => {
    expect(parseIssueKey("NEKI-42")).toEqual({ teamKey: "NEKI", number: 42 });
    expect(parseIssueKey("design-7")).toEqual({ teamKey: "DESIGN", number: 7 });
  });

  it("returns null for non-key strings (cuids, plain numbers, garbage)", () => {
    expect(parseIssueKey("cl# not a key")).toBeNull();
    expect(parseIssueKey("123")).toBeNull();
    expect(parseIssueKey("ckhx3n0000")).toBeNull();
    expect(parseIssueKey("")).toBeNull();
  });
});
