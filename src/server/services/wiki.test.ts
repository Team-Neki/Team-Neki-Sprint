import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    wikiPage: { updateMany: vi.fn() },
    wikiRevision: { create: vi.fn() },
    notification: { createMany: vi.fn() },
  };
  const prisma = {
    wikiPage: { findUnique: vi.fn() },
    wikiDraft: { deleteMany: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { tx, prisma, newMentionRecipients: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/server/notify", () => ({ newMentionRecipients: m.newMentionRecipients }));
import { updateWikiContentCore } from "./wiki";

const actor = { id: "me", role: "MEMBER" as const };
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const page = { id: "p", title: "T", content: doc("old"), editorId: "other", isDraft: false };

describe("updateWikiContentCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.prisma.wikiPage.findUnique.mockResolvedValue(page);
    m.newMentionRecipients.mockResolvedValue(["u1"]);
  });

  it("returns conflict without a revision or notification when the page moved past the expected updatedAt", async () => {
    m.tx.wikiPage.updateMany.mockResolvedValue({ count: 0 });
    const res = await updateWikiContentCore(actor, "p", "T", doc("new"), "2026-10-04T00:00:00.000Z");
    expect(res).toEqual({ conflict: true });
    expect(m.tx.wikiPage.updateMany.mock.calls[0][0].where).toEqual({ id: "p", updatedAt: new Date("2026-10-04T00:00:00.000Z") });
    expect(m.tx.wikiRevision.create).not.toHaveBeenCalled();
    expect(m.tx.notification.createMany).not.toHaveBeenCalled();
  });

  it("writes page, revision and mention notifications in one transaction", async () => {
    m.tx.wikiPage.updateMany.mockResolvedValue({ count: 1 });
    expect(await updateWikiContentCore(actor, "p", "T", doc("new"))).toEqual({ id: "p" });
    expect(m.tx.wikiPage.updateMany.mock.calls[0][0].where).toEqual({ id: "p" });
    expect(m.tx.wikiRevision.create).toHaveBeenCalledTimes(1);
    expect(m.tx.notification.createMany).toHaveBeenCalledTimes(1);
  });
});
