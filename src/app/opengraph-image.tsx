import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG_WORDMARK, OG_HEADLINE, OG_TAGLINE } from "@/lib/og";

// OG/Twitter 공유 이미지(1200×630). canvas-soft 배경 + Sprint 워드마크 + 막대 마크.
//
// 한글: satori 기본 폰트에는 한글 글리프가 없어 그냥 쓰면 두부로 렌더된다. 그래서
// 문구에 쓰인 글자만 남긴 Pretendard 서브셋(assets/fonts/, 웨이트당 ~6KB)을 먹인다.
// 문구는 lib/og.ts 에 있고, 고쳤으면 `npm run og:font` 로 폰트도 다시 만들어야 한다.
// (빠뜨리면 og.test.ts 가 먼저 깨진다.)
export const alt = "Sprint — 팀 워크스페이스";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONT_DIR = join(process.cwd(), "assets/fonts");

export default async function Image() {
  const [regular, semiBold] = await Promise.all([
    readFile(join(FONT_DIR, "Pretendard-Regular.subset.ttf")),
    readFile(join(FONT_DIR, "Pretendard-SemiBold.subset.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          background: "#fafafa",
          fontFamily: "Pretendard",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          {/* 막대 마크(app/icon.svg 와 동일 모티프) */}
          <div
            style={{
              width: 104,
              height: 104,
              borderRadius: 24,
              background: "#171717",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 10,
              paddingBottom: 26,
            }}
          >
            <div style={{ width: 13, height: 26, borderRadius: 4, background: "#fff" }} />
            <div style={{ width: 13, height: 44, borderRadius: 4, background: "#fff" }} />
            <div style={{ width: 13, height: 62, borderRadius: 4, background: "#fff" }} />
          </div>
          <div
            style={{
              fontSize: 88,
              fontWeight: 600,
              color: "#171717",
              letterSpacing: "-3px",
            }}
          >
            {OG_WORDMARK}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 46,
            fontWeight: 600,
            color: "#171717",
            letterSpacing: "-1.5px",
            marginTop: 48,
          }}
        >
          {OG_HEADLINE}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            color: "#4d4d4d",
            letterSpacing: "-0.5px",
            marginTop: 16,
          }}
        >
          {OG_TAGLINE}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: regular, style: "normal", weight: 400 },
        { name: "Pretendard", data: semiBold, style: "normal", weight: 600 },
      ],
    },
  );
}
