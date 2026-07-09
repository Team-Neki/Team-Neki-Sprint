"use client";

/**
 * 루트 에러 바운더리. 루트 레이아웃(app/layout) 자체가 렌더 중 throw 할 때만
 * 발동하며, 이 경우 레이아웃이 없으므로 자체 <html>/<body> 를 렌더해야 한다.
 * 전역 CSS 로딩을 보장할 수 없어 인라인 스타일로 최소 폴백만 제공(라이트 테마).
 * 일반 페이지 오류는 (app)/error.tsx 가 처리하므로 이건 극단 상황용 안전망이다.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          color: "#171717",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "24rem", padding: "1rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600 }}>
            문제가 발생했습니다
          </h2>
          <p style={{ color: "#4d4d4d", fontSize: "0.875rem" }}>
            앱을 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "#171717",
              color: "#ffffff",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
