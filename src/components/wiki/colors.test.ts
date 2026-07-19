import { describe, expect, it } from "vitest";
import { TEXT_COLORS, BG_COLORS, CELL_COLORS } from "@/components/wiki/colors";

describe("colors 팔레트 정본", () => {
  it("글자 색은 10종, 배경색은 9종이다", () => {
    expect(TEXT_COLORS).toHaveLength(10);
    expect(BG_COLORS).toHaveLength(9);
  });

  it("값과 이름에 중복이 없다", () => {
    for (const palette of [TEXT_COLORS, BG_COLORS]) {
      const values = palette.map((c) => c.value);
      const names = palette.map((c) => c.name);
      expect(new Set(values).size).toBe(values.length);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("모든 값은 hex 색상이다", () => {
    for (const c of [...TEXT_COLORS, ...BG_COLORS]) {
      expect(c.value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("셀 배경은 BG_COLORS 를 재사용한다", () => {
    expect(CELL_COLORS).toBe(BG_COLORS);
  });
});
