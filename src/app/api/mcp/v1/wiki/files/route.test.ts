import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateBearer: vi.fn(), putWikiFile: vi.fn(), create: vi.fn(),
}));
vi.mock("@/lib/api-token", () => ({ authenticateBearer: mocks.authenticateBearer }));
vi.mock("@/lib/s3", () => ({ newWikiFileKey: () => "wiki-files/key", putWikiFile: mocks.putWikiFile }));
vi.mock("@/lib/prisma", () => ({ prisma: { wikiFile: { create: mocks.create } } }));
import { POST } from "./route";

const ctx = { params: Promise.resolve({}) };
const actor = { id: "actor", role: "MEMBER" };
const upload = (file?: File, authorization = "Bearer test") => {
  const form = new FormData();
  if (file) form.set("file", file);
  return new Request("https://sprint.test/api/mcp/v1/wiki/files", {
    method: "POST", headers: { authorization }, body: form,
  });
};

describe("MCP wiki file upload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticateBearer.mockResolvedValue(actor);
    mocks.create.mockResolvedValue({ id: "file1" });
  });

  it("stores the file as the token owner and returns attachment metadata", async () => {
    const res = await POST(upload(new File([new Uint8Array([1, 2, 3])], "dist.p12", { type: "application/x-pkcs12" })), ctx);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, data: {
      id: "file1", url: "/api/wiki/file/file1", name: "dist.p12", size: 3, mimeType: "application/x-pkcs12",
    } });
    expect(mocks.putWikiFile).toHaveBeenCalledWith("wiki-files/key", expect.any(Buffer), "application/x-pkcs12");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ uploaderId: "actor", name: "dist.p12" }),
    }));
  });

  it("falls back to octet-stream when the type is unknown", async () => {
    const res = await POST(upload(new File(["x"], "a.mobileprovision")), ctx);
    expect((await res.json()).data.mimeType).toBe("application/octet-stream");
  });

  it("rejects inline-executable types without storing", async () => {
    const res = await POST(upload(new File(["<svg/>"], "a.svg", { type: "image/svg+xml" })), ctx);
    expect(res.status).toBe(415);
    expect(mocks.putWikiFile).not.toHaveBeenCalled();
  });

  it("returns 400 when the file field is missing", async () => {
    const res = await POST(upload(), ctx);
    expect(res.status).toBe(400);
  });

  it("returns 401 without a valid token", async () => {
    mocks.authenticateBearer.mockResolvedValue(null);
    const res = await POST(upload(new File(["x"], "a.txt", { type: "text/plain" }), "Bearer bad"), ctx);
    expect(res.status).toBe(401);
    expect(mocks.putWikiFile).not.toHaveBeenCalled();
  });
});
