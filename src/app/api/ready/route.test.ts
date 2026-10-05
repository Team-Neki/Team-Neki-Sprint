import { afterEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));

describe("GET /api/ready", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("웜업이 끝날 때까지 503, 끝나면 200 이고 웜업은 한 번만 돈다", async () => {
    let finishDb!: () => void;
    queryRaw.mockReturnValue(new Promise<void>((r) => (finishDb = r)));
    const fetchMock = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("./route");

    expect(GET().status).toBe(503);
    expect(GET().status).toBe(503);
    finishDb();
    await vi.waitFor(() => expect(GET().status).toBe(200));
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    const calls = fetchMock.mock.calls.length;
    GET();
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("웜업 요청이 실패해도 끝나면 200", async () => {
    queryRaw.mockRejectedValue(new Error("db down"));
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("boom"))));
    const { GET } = await import("./route");

    expect(GET().status).toBe(503);
    await vi.waitFor(() => expect(GET().status).toBe(200));
  });
});
