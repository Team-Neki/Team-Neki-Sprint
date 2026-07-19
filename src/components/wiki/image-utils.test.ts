import { describe, expect, it } from "vitest";
import {
  IMAGE_MIN_WIDTH,
  normalizeAlign,
  parseWidthAttr,
  resizeWidth,
} from "@/components/wiki/image-utils";

describe("normalizeAlign", () => {
  it("center/right 는 그대로 통과한다", () => {
    expect(normalizeAlign("center")).toBe("center");
    expect(normalizeAlign("right")).toBe("right");
  });

  it("left·미지정·알 수 없는 값은 left 로 정규화한다", () => {
    expect(normalizeAlign("left")).toBe("left");
    expect(normalizeAlign(null)).toBe("left");
    expect(normalizeAlign(undefined)).toBe("left");
    expect(normalizeAlign("justify")).toBe("left");
  });
});

describe("parseWidthAttr", () => {
  it("숫자·숫자 문자열을 반올림한 px 로 파싱한다", () => {
    expect(parseWidthAttr(320)).toBe(320);
    expect(parseWidthAttr("320")).toBe(320);
    expect(parseWidthAttr("320.6px")).toBe(321);
  });

  it("비어 있거나 양의 유한수가 아니면 null(원본 크기)", () => {
    expect(parseWidthAttr(null)).toBeNull();
    expect(parseWidthAttr(undefined)).toBeNull();
    expect(parseWidthAttr("")).toBeNull();
    expect(parseWidthAttr("abc")).toBeNull();
    expect(parseWidthAttr(0)).toBeNull();
    expect(parseWidthAttr(-5)).toBeNull();
    expect(parseWidthAttr(Infinity)).toBeNull();
  });
});

describe("resizeWidth", () => {
  it("오른쪽 핸들은 +delta 로 커지고 왼쪽 핸들은 -delta 로 커진다", () => {
    expect(resizeWidth(300, 50, "right", 700)).toBe(350);
    expect(resizeWidth(300, 50, "left", 700)).toBe(250);
    expect(resizeWidth(300, -50, "left", 700)).toBe(350);
  });

  it("최소 IMAGE_MIN_WIDTH, 최대 maxWidth 로 클램프한다", () => {
    expect(resizeWidth(100, -500, "right", 700)).toBe(IMAGE_MIN_WIDTH);
    expect(resizeWidth(600, 500, "right", 700)).toBe(700);
  });

  it("maxWidth 가 최소값보다 작으면 maxWidth 가 우선한다", () => {
    expect(resizeWidth(100, -500, "right", 60)).toBe(60);
    expect(resizeWidth(100, 500, "right", 60)).toBe(60);
  });

  it("소수 좌표는 반올림한다", () => {
    expect(resizeWidth(300.4, 10.3, "right", 700)).toBe(311);
  });
});
