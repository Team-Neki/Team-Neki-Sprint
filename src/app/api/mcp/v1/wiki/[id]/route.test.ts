import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type Where = { id: string; deletedAt?: null; OR?: Row[] };

const mocks = vi.hoisted(() => ({
  authenticateBearer: vi.fn(), updateWikiContentCore: vi.fn(),
  rows: [] as Row[],
}));
// 실제 getWikiPage 의 where(id·deletedAt·OR)를 평가하는 최소 findFirst — 초안 규칙을 목이 아니라 쿼리로 검증한다.
const matches = (where: Where, row: Row) =>
  row.id === where.id &&
  (where.deletedAt !== null || row.deletedAt == null) &&
  (!where.OR || where.OR.some((c) => Object.entries(c).every(([k, v]) => row[k] === v)));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    wikiPage: {
      findFirst: async ({ where }: { where: Where }) => mocks.rows.find((r) => matches(where, r)) ?? null,
    },
  },
}));
vi.mock("@/lib/api-token", () => ({ authenticateBearer: mocks.authenticateBearer }));
vi.mock("@/server/services/wiki", () => ({ updateWikiContentCore: mocks.updateWikiContentCore }));
import { GET, PATCH } from "./route";

const actor = { id: "me", role: "MEMBER" };
const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "draft body" }] }] };
const page = (id: string, extra: Row) => ({
  id, title: "Draft", folderId: null, parentId: null, content: doc,
  updatedAt: new Date("2026-10-04T00:00:00.000Z"), deletedAt: null, ...extra,
});
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (id: string, init?: RequestInit) => new Request(`https://sprint.test/api/mcp/v1/wiki/${id}`, {
  ...init, headers: { authorization: "Bearer test", "content-type": "application/json" },
});
const patch = (id: string) => PATCH(req(id, { method: "PATCH", body: JSON.stringify({ title: "New" }) }), ctx(id));

describe("MCP wiki page draft and trash guard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authenticateBearer.mockResolvedValue(actor);
    mocks.updateWikiContentCore.mockResolvedValue({ id: "x" });
    mocks.rows = [
      page("theirs", { isDraft: true, authorId: "someone-else" }),
      page("mine", { isDraft: true, authorId: "me" }),
      page("trashed", { isDraft: false, authorId: "me", deletedAt: new Date() }),
    ];
  });

  it("hides another user's draft from GET and PATCH", async () => {
    expect((await GET(req("theirs"), ctx("theirs"))).status).toBe(404);
    expect((await patch("theirs")).status).toBe(404);
    expect(mocks.updateWikiContentCore).not.toHaveBeenCalled();
  });

  it("hides trashed pages from GET and PATCH", async () => {
    expect((await GET(req("trashed"), ctx("trashed"))).status).toBe(404);
    expect((await patch("trashed")).status).toBe(404);
    expect(mocks.updateWikiContentCore).not.toHaveBeenCalled();
  });

  it("serves and updates the actor's own draft", async () => {
    const res = await GET(req("mine"), ctx("mine"));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ id: "mine", title: "Draft", text: "draft body" });

    expect((await patch("mine")).status).toBe(200);
    expect(mocks.updateWikiContentCore).toHaveBeenCalledWith(actor, "mine", "New", doc);
  });
});
