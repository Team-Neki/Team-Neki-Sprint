import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Actor } from "@/lib/authz";

export const TOKEN_PREFIX = "sprint_pat_";

/** sha-256 hex of the raw token. Only the hash is stored. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** "Bearer <token>" -> token, else null. */
export function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim();
  return token ? token : null;
}

/** Create a new raw token + its hash + a display prefix. randomFn is injectable for tests. */
export function buildToken(
  randomFn: (n: number) => Uint8Array = (n) => randomBytes(n),
): { raw: string; hash: string; prefix: string } {
  const body = Buffer.from(randomFn(24)).toString("base64url");
  const raw = `${TOKEN_PREFIX}${body}`;
  return {
    raw,
    hash: hashToken(raw),
    prefix: raw.slice(0, TOKEN_PREFIX.length + 4),
  };
}

/**
 * Authenticate an incoming request by bearer token.
 * Returns the acting user as an Actor, or null if the token is missing/invalid/revoked.
 * Updates lastUsedAt (best-effort, throttled to once/minute).
 */
export async function authenticateBearer(
  authorization: string | null,
): Promise<Actor | null> {
  const raw = parseBearer(authorization);
  if (!raw) return null;
  const tokenHash = hashToken(raw);
  const token = await prisma.apiToken.findFirst({
    where: { tokenHash, revokedAt: null },
    select: {
      id: true,
      lastUsedAt: true,
      user: { select: { id: true, role: true, status: true } },
    },
  });
  if (!token) return null;
  // 가입 승인 전(PENDING) 계정의 토큰은 유효해도 거부한다.
  if (token.user.status !== "APPROVED") return null;

  const now = Date.now();
  const last = token.lastUsedAt?.getTime() ?? 0;
  if (now - last > 60_000) {
    await prisma.apiToken
      .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }
  return { id: token.user.id, role: token.user.role };
}
