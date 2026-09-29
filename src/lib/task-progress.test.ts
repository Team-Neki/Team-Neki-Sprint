import { describe, expect, it } from "vitest";
import {
  EMPTY_PROGRESS,
  countStatuses,
  progressPercent,
  progressTotal,
  sumProgress,
} from "./task-progress";

describe("countStatuses", () => {
  it("상태별로 센다", () => {
    expect(
      countStatuses([
        { status: "DONE" },
        { status: "TODO" },
        { status: "DONE" },
        { status: "IN_PROGRESS" },
      ]),
    ).toEqual({ TODO: 1, IN_PROGRESS: 1, DONE: 2 });
  });

  it("빈 배열은 전부 0", () => {
    expect(countStatuses([])).toEqual({ TODO: 0, IN_PROGRESS: 0, DONE: 0 });
  });

  it("EMPTY_PROGRESS 를 변형하지 않는다", () => {
    countStatuses([{ status: "DONE" }]);
    expect(EMPTY_PROGRESS).toEqual({ TODO: 0, IN_PROGRESS: 0, DONE: 0 });
  });
});

describe("sumProgress", () => {
  it("상태별로 더한다", () => {
    expect(
      sumProgress([
        { TODO: 1, IN_PROGRESS: 2, DONE: 3 },
        { TODO: 4, IN_PROGRESS: 0, DONE: 1 },
      ]),
    ).toEqual({ TODO: 5, IN_PROGRESS: 2, DONE: 4 });
  });

  it("빈 목록은 전부 0", () => {
    expect(sumProgress([])).toEqual({ TODO: 0, IN_PROGRESS: 0, DONE: 0 });
  });
});

describe("progressTotal", () => {
  it("세 상태의 합", () => {
    expect(progressTotal({ TODO: 1, IN_PROGRESS: 2, DONE: 3 })).toBe(6);
  });
});

describe("progressPercent", () => {
  it("0건이면 null", () => {
    expect(progressPercent({ TODO: 0, IN_PROGRESS: 0, DONE: 0 })).toBeNull();
  });

  it("내림한다(1/3 → 33, 2/3 → 66)", () => {
    expect(progressPercent({ TODO: 2, IN_PROGRESS: 0, DONE: 1 })).toBe(33);
    expect(progressPercent({ TODO: 1, IN_PROGRESS: 0, DONE: 2 })).toBe(66);
  });

  it("모두 끝나기 전엔 100 이 아니다(199/200 → 99)", () => {
    expect(progressPercent({ TODO: 1, IN_PROGRESS: 0, DONE: 199 })).toBe(99);
  });

  it("모두 완료면 100", () => {
    expect(progressPercent({ TODO: 0, IN_PROGRESS: 0, DONE: 5 })).toBe(100);
  });

  it("진행 중은 % 에 넣지 않는다", () => {
    expect(progressPercent({ TODO: 0, IN_PROGRESS: 3, DONE: 1 })).toBe(25);
  });
});
