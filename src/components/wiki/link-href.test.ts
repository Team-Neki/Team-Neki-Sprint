import { describe, it, expect } from "vitest";
import { normalizeHref } from "./link-href";

describe("normalizeHref", () => {
  it("스킴 없는 도메인엔 https:// 를 붙인다", () => {
    expect(normalizeHref("example.com")).toBe("https://example.com");
    expect(normalizeHref(" example.com/path?q=1 ")).toBe("https://example.com/path?q=1");
  });
  it("이미 스킴이 있으면 그대로", () => {
    expect(normalizeHref("http://a.b")).toBe("http://a.b");
    expect(normalizeHref("https://a.b")).toBe("https://a.b");
    expect(normalizeHref("mailto:x@y.z")).toBe("mailto:x@y.z");
    expect(normalizeHref("tel:+8210")).toBe("tel:+8210");
  });
  it("앵커·상대경로·프로토콜 상대는 그대로", () => {
    expect(normalizeHref("#section")).toBe("#section");
    expect(normalizeHref("/wiki/abc")).toBe("/wiki/abc");
    expect(normalizeHref("//cdn.example.com/x")).toBe("//cdn.example.com/x");
  });
  it("빈 값과 위험 스킴은 null", () => {
    expect(normalizeHref("")).toBeNull();
    expect(normalizeHref("   ")).toBeNull();
    expect(normalizeHref("javascript:alert(1)")).toBeNull();
    expect(normalizeHref("JavaScript:alert(1)")).toBeNull();
    expect(normalizeHref("data:text/html,hi")).toBeNull();
    expect(normalizeHref("vbscript:x")).toBeNull();
  });
});
