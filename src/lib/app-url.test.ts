import { describe, it, expect } from "vitest";
import { resolveAppUrl } from "@/lib/app-url";

// metadataBase 폴백 규칙. 빈 문자열을 흘려보내면 new URL("") 로 빌드가 죽으므로
// undefined/null 뿐 아니라 공백-only 도 미설정으로 접는다.
describe("resolveAppUrl", () => {
  it("값이 있으면 그대로 쓴다", () => {
    expect(resolveAppUrl("https://sprint.suitestudy.com:4641")).toBe(
      "https://sprint.suitestudy.com:4641",
    );
  });

  it("앞뒤 공백은 잘라낸다", () => {
    expect(resolveAppUrl("  https://example.com  ")).toBe(
      "https://example.com",
    );
  });

  it("undefined/null/빈 문자열/공백-only → localhost 폴백", () => {
    expect(resolveAppUrl(undefined)).toBe("http://localhost:3000");
    expect(resolveAppUrl(null)).toBe("http://localhost:3000");
    expect(resolveAppUrl("")).toBe("http://localhost:3000");
    expect(resolveAppUrl("   ")).toBe("http://localhost:3000");
  });

  it("폴백 값은 new URL 로 파싱 가능해야 한다", () => {
    expect(() => new URL(resolveAppUrl(undefined))).not.toThrow();
  });
});
