import { ImageResponse } from "next/og";

// OG/Twitter 공유 이미지(1200×630). ink 캔버스 + Sprint 워드마크 + 막대 마크.
// 주의: satori 기본 폰트는 한글 글리프가 없어 렌더가 깨질 수 있으므로, 이미지 안
// 텍스트는 영문만 쓴다(메타 description/alt 는 한글 유지 — 렌더가 아니라 텍스트라 무관).
export const alt = "Sprint — 팀 워크스페이스";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
            Sprint
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 36, color: "#4d4d4d", marginTop: 40 }}>
          Plan, track, and document — sprints, projects, epics, tasks & wiki.
        </div>
      </div>
    ),
    { ...size },
  );
}
