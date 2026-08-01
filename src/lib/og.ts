/**
 * OG 공유 이미지(app/opengraph-image.tsx)에 렌더되는 문구.
 *
 * 이미지에 쓰는 폰트는 Pretendard 를 **여기 있는 글자만** 남기고 서브셋한 것이다
 * (assets/fonts/). 그래서 문구를 고치면 폰트도 같이 다시 만들어야 한다:
 *
 *     npm run og:font
 *
 * 안 하면 새로 넣은 글자가 두부(tofu)로 렌더된다. `og.test.ts` 가 문구와
 * `OG_FONT_GLYPHS` 의 어긋남을 잡아주므로, 잊으면 테스트가 먼저 깨진다.
 */
export const OG_WORDMARK = "Sprint";
export const OG_HEADLINE = "일정과 문서를 한곳에서.";
export const OG_TAGLINE = "스프린트 · 프로젝트 · 에픽 · 태스크 + 위키";

/** 이미지에 렌더되는 모든 문자열. 서브셋 글자 목록의 입력이기도 하다. */
export const OG_TEXTS = [OG_WORDMARK, OG_HEADLINE, OG_TAGLINE] as const;

/**
 * 서브셋된 폰트가 실제로 담고 있는 글자(중복 제거·코드포인트 정렬).
 * `npm run og:font` 가 OG_TEXTS 로부터 다시 생성해 이 파일에 써넣는다.
 * 손으로 고치지 말 것.
 */
export const OG_FONT_GLYPHS = " +.Sinprt·곳과로를린문서스에위일정젝크키태트프픽한";

/** 문자열에 쓰인 글자를 중복 없이 코드포인트 순으로 돌려준다. */
export function uniqueGlyphs(texts: readonly string[]): string {
  return [...new Set(texts.join(""))].sort().join("");
}
