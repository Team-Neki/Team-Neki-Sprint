import type { MetadataRoute } from "next";

/**
 * Sprint 는 Google Workspace SSO 로 잠긴 사내 전용 워크스페이스라 검색 색인 대상이
 * 아니다. 다만 `User-agent: *` 에 전면 Disallow 만 걸면 카카오톡·슬랙 같은 **링크
 * 미리보기 봇까지 막혀** OG 카드가 통째로 사라진다(이 봇들도 robots.txt 를 따른다).
 * 그래서 미리보기 봇은 명시적으로 열어둔다.
 *
 * 실제 색인 차단은 layout.tsx 의 `robots: { index: false }`(=noindex 메타)가 맡는다.
 * Disallow 만으로는 크롤러가 페이지를 못 읽어 noindex 를 볼 수 없고, 그러면 URL 만
 * 알맹이 없이 검색결과에 남을 수 있다 — 색인을 빼는 정공법은 noindex 쪽이다.
 */
const PREVIEW_BOTS = [
  "facebookexternalhit", // 페이스북·인스타그램
  "Twitterbot",
  "Slackbot-LinkExpanding",
  "kakaotalk-scrap", // 카카오톡
  "Discordbot",
  "TelegramBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // robots.txt 는 가장 구체적으로 매칭되는 그룹 하나만 적용된다.
      { userAgent: PREVIEW_BOTS, allow: "/" },
      { userAgent: "*", disallow: "/" },
    ],
  };
}
