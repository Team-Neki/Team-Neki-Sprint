import { describe, it, expect } from "vitest";
import { SprintClient, ApiError } from "./client";

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

  it("throws ApiError with a described message on failure", async () => {
    const c = new SprintClient(
      cfg,
      fakeFetch(422, { ok: false, error: "unknown team: ZZZ" }),
    );
    await expect(c.post("/x", {})).rejects.toBeInstanceOf(ApiError);
    await expect(c.post("/x", {})).rejects.toThrow(/unknown team/);
  });
});
