import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "@/lib/github/signature";

function sign(body: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const secret = "s3cr3t";
  const body = JSON.stringify({ hello: "world" });

  it("올바른 서명은 true", () => {
    expect(verifyWebhookSignature(body, sign(body, secret), secret)).toBe(true);
  });
  it("틀린 서명은 false", () => {
    expect(verifyWebhookSignature(body, sign(body, "wrong"), secret)).toBe(false);
  });
  it("헤더 없음은 false", () => {
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
  });
  it("본문 변조는 false", () => {
    expect(verifyWebhookSignature(body + "x", sign(body, secret), secret)).toBe(
      false,
    );
  });
});
