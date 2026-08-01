import { describe, it, expect } from "vitest";
import { prEventToStatus } from "@/lib/github/pr-status";

describe("prEventToStatus", () => {
  it("opened -> OPEN, IN_PROGRESS", () => {
    expect(prEventToStatus("opened", false)).toEqual({
      prState: "OPEN",
      taskStatus: "IN_PROGRESS",
    });
  });
  it("reopened/ready_for_review 도 OPEN, IN_PROGRESS", () => {
    expect(prEventToStatus("reopened", false)?.taskStatus).toBe("IN_PROGRESS");
    expect(prEventToStatus("ready_for_review", false)?.prState).toBe("OPEN");
  });
  it("closed + merged -> MERGED, DONE", () => {
    expect(prEventToStatus("closed", true)).toEqual({
      prState: "MERGED",
      taskStatus: "DONE",
    });
  });
  it("closed + !merged -> CLOSED, 상태 변경 없음", () => {
    expect(prEventToStatus("closed", false)).toEqual({
      prState: "CLOSED",
      taskStatus: null,
    });
  });
  it("알 수 없는 action 은 null", () => {
    expect(prEventToStatus("synchronize", false)).toBeNull();
  });
});
