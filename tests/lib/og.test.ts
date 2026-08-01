import { describe, it, expect } from "vitest";
import {
  OG_TEXTS,
  OG_FONT_GLYPHS,
  OG_WORDMARK,
  uniqueGlyphs,
} from "@/lib/og";

describe("uniqueGlyphs", () => {
  it("중복을 없애고 코드포인트 순으로 정렬한다", () => {
    expect(uniqueGlyphs(["ba", "ab"])).toBe("ab");
    expect(uniqueGlyphs(["가나", "나다"])).toBe("가나다");
  });

  it("빈 입력은 빈 문자열", () => {
    expect(uniqueGlyphs([])).toBe("");
  });
});

describe("OG 문구와 서브셋 폰트 글자 목록", () => {
  // assets/fonts/*.subset.ttf 에는 OG_FONT_GLYPHS 의 글자만 들어 있다. 문구를
  // 고치고 `npm run og:font` 를 잊으면 새 글자가 두부로 렌더되므로 여기서 막는다.
  it("문구에 쓰인 글자가 전부 서브셋에 있다 (아니면 `npm run og:font`)", () => {
    const used = uniqueGlyphs(OG_TEXTS);
    const missing = [...used].filter((c) => !OG_FONT_GLYPHS.includes(c));
    expect(missing).toEqual([]);
    expect(used).toBe(OG_FONT_GLYPHS);
  });

  it("워드마크는 라틴 문자라 폰트 없이도 안전하다", () => {
    expect(OG_WORDMARK).toMatch(/^[\x20-\x7e]+$/);
  });
});
