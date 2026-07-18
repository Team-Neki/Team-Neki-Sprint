import { describe, it, expect } from "vitest";
import { TOKEN_PREFIX, hashToken, parseBearer, buildToken } from "./api-token";

describe("api-token", () => {
  it("hashToken is deterministic sha-256 hex (64 chars)", () => {
    const a = hashToken("sprint_pat_abc");
    const b = hashToken("sprint_pat_abc");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("other")).not.toBe(a);
  });

  it("buildToken returns a prefixed raw token, its hash, and a display prefix", () => {
    const t = buildToken(() => new Uint8Array(24).fill(1));
    expect(t.raw.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(t.hash).toBe(hashToken(t.raw));
    expect(t.prefix.length).toBeGreaterThanOrEqual(12);
    expect(t.raw.startsWith(t.prefix)).toBe(true);
  });

  it("parseBearer extracts the token from an Authorization header", () => {
    expect(parseBearer("Bearer sprint_pat_xyz")).toBe("sprint_pat_xyz");
    expect(parseBearer("bearer sprint_pat_xyz")).toBe("sprint_pat_xyz");
    expect(parseBearer("Basic abc")).toBeNull();
    expect(parseBearer(null)).toBeNull();
    expect(parseBearer("Bearer   ")).toBeNull();
  });
});
