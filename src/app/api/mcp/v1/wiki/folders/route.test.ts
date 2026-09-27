import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateBearer, getWikiFolders } = vi.hoisted(() => ({
  authenticateBearer: vi.fn(),
  getWikiFolders: vi.fn(),
}));
vi.mock("@/lib/api-token", () => ({ authenticateBearer }));
vi.mock("@/server/queries", () => ({ getWikiFolders }));
import { GET } from "./route";

const ctx = { params: Promise.resolve({}) };
const request = () => new Request("https://sprint.test/api/mcp/v1/wiki/folders", {
  headers: { authorization: "Bearer test-token" },
});

describe("MCP wiki folders", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authenticateBearer.mockResolvedValue({ id: "actor", role: "MEMBER" });
  });

  it("returns the full hierarchy including duplicate names under different parents", async () => {
    const folders = [
      { id: "planning", name: "기획", parentId: null, position: 0 },
      { id: "engineering", name: "개발", parentId: null, position: 1 },
      { id: "target", name: "사용자 행동 지표 싱크", parentId: "planning", position: 0 },
      { id: "other", name: "사용자 행동 지표 싱크", parentId: "engineering", position: 0 },
    ];
    getWikiFolders.mockResolvedValue(folders);
    const response = await GET(request(), ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: folders });
    expect(authenticateBearer).toHaveBeenCalledWith("Bearer test-token");
  });

  it("returns an empty list when there are no folders", async () => {
    getWikiFolders.mockResolvedValue([]);
    expect(await (await GET(request(), ctx)).json()).toEqual({ ok: true, data: [] });
  });

  it("rejects invalid or absent authentication without querying folders", async () => {
    authenticateBearer.mockResolvedValue(null);
    for (const req of [request(), new Request("https://sprint.test/api/mcp/v1/wiki/folders")]) {
      const response = await GET(req, ctx);
      expect(response.status).toBe(401);
    }
    expect(getWikiFolders).not.toHaveBeenCalled();
  });

  it("masks unexpected database errors", async () => {
    getWikiFolders.mockRejectedValue(new Error("private connection detail"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await GET(request(), ctx);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ ok: false, error: "internal_error" });
    } finally { spy.mockRestore(); }
  });
});
