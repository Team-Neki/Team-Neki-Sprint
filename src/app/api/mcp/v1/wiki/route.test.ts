import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateBearer: vi.fn(), getWikiFolders: vi.fn(), searchWikiPages: vi.fn(),
  createWikiPageCore: vi.fn(), updateWikiContentCore: vi.fn(),
}));
vi.mock("@/lib/api-token", () => ({ authenticateBearer: mocks.authenticateBearer }));
vi.mock("@/server/queries", () => ({ getWikiFolders: mocks.getWikiFolders, searchWikiPages: mocks.searchWikiPages }));
vi.mock("@/server/services/wiki", () => ({ createWikiPageCore: mocks.createWikiPageCore, updateWikiContentCore: mocks.updateWikiContentCore }));
import { POST } from "./route";

const ctx = { params: Promise.resolve({}) };
const actor = { id: "actor", role: "MEMBER" };
const request = (body: unknown) => new Request("https://sprint.test/api/mcp/v1/wiki", {
  method: "POST", headers: { authorization: "Bearer test", "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("MCP folder page creation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticateBearer.mockResolvedValue(actor);
    mocks.getWikiFolders.mockResolvedValue([{ id: "target", name: "Sync", parentId: "planning", position: 0 }]);
    mocks.createWikiPageCore.mockResolvedValue({ id: "page" });
  });

  it("preserves rich table content and creates in the requested folder", async () => {
    const contentJson = { type: "doc", content: [{ type: "table", content: [] }] };
    const response = await POST(request({ title: "Title", folderId: "target", body: "ignored", contentJson }), ctx);
    expect(response.status).toBe(201);
    expect(mocks.createWikiPageCore).toHaveBeenCalledWith(actor, { title: "Title", folderId: "target", parentId: null });
    expect(mocks.updateWikiContentCore).toHaveBeenCalledWith(actor, "page", "Title", contentJson);
  });

  it("returns 404 without creating a page when the folder no longer exists", async () => {
    const response = await POST(request({ title: "Title", folderId: "missing" }), ctx);
    expect(response.status).toBe(404);
    expect(mocks.createWikiPageCore).not.toHaveBeenCalled();
    expect(mocks.updateWikiContentCore).not.toHaveBeenCalled();
  });

  it("continues creating markdown pages at the root without folder lookup", async () => {
    const response = await POST(request({ title: "Title", body: "# Heading" }), ctx);
    expect(response.status).toBe(201);
    expect(mocks.getWikiFolders).not.toHaveBeenCalled();
    expect(mocks.updateWikiContentCore.mock.calls[0][3].content[0].type).toBe("heading");
  });

  it("rejects invalid rich content before any writes", async () => {
    const response = await POST(request({ title: "Title", contentJson: { type: "table" } }), ctx);
    expect(response.status).toBe(400);
    expect(mocks.createWikiPageCore).not.toHaveBeenCalled();
  });
});
