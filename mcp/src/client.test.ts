import { describe, it, expect } from "vitest";
import { SprintClient } from "./client";

const cfg = { apiUrl: "https://sprint.test", token: "sprint_pat_x" };

function fakeFetch(status: number, payload: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("SprintClient", () => {
  it("returns data on success", async () => {
    const c = new SprintClient(cfg, fakeFetch(200, { ok: true, data: { id: "1" } }));
    expect(await c.get("/x")).toEqual({ id: "1" });
  });

  it.each([
    ["malformed JSON", "{"],
    ["empty body", ""],
    ["missing ok", '{"data":{"id":"1"}}'],
    ["missing data", '{"ok":true}'],
  ])("rejects a 2xx response with %s", async (_case, body) => {
    const c = new SprintClient(
      cfg,
      (async () => new Response(body, { status: 200 })) as typeof fetch,
    );
    await expect(c.get("/x")).rejects.toMatchObject({
      name: "ApiError",
      status: 200,
      message: expect.stringContaining("Invalid API response"),
    });
  });

  it("throws ApiError with a described message on failure", async () => {
    const c = new SprintClient(
      cfg,
      fakeFetch(422, { ok: false, error: "unknown team: ZZZ" }),
    );
    await expect(c.post("/x", {})).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      message: "unknown team: ZZZ",
    });
  });

  it("keeps a 5xx API message and status", async () => {
    const c = new SprintClient(
      cfg,
      fakeFetch(500, { ok: false, error: "internal_error" }),
    );
    await expect(c.get("/x")).rejects.toMatchObject({
      status: 500,
      message: "internal_error",
    });
  });

  it("supports DELETE via del()", async () => {
    const c = new SprintClient(cfg, fakeFetch(200, { ok: true, data: { id: "1" } }));
    expect(await c.del("/x")).toEqual({ id: "1" });
  });

  it("maps 403 delete rejection to ApiError", async () => {
    const c = new SprintClient(
      cfg,
      fakeFetch(403, { ok: false, error: "에픽 삭제 권한이 없습니다." }),
    );
    await expect(c.del("/x")).rejects.toThrow(/삭제 권한/);
  });
});
