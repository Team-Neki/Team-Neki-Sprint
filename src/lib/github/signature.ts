import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * GitHub webhook 서명 검증. signatureHeader 는 "sha256=..." 형식(X-Hub-Signature-256).
 * rawBody 는 파싱 전 요청 원문. 상수시간 비교.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
