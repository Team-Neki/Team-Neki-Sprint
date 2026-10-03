import { z } from "zod";
import { withMcpAuth, ok, fail, parseLimit } from "@/server/api/mcp-auth";
import { createWikiPageCore } from "@/server/services/wiki";
import { getWikiFolders, searchWikiPages } from "@/server/queries";
import { markdownToDoc } from "@/lib/text-to-doc";
import { tiptapDocSchema } from "@/lib/tiptap-doc";

export const dynamic = "force-dynamic";

const createInput = z.object({
  title: z.string().trim().min(1),
  body: z.string().nullish(), // markdown subset
  contentJson: tiptapDocSchema.nullish(), // raw Tiptap doc (advanced)
  parentId: z.string().trim().nullish(),
  folderId: z.string().trim().nullish(),
});

export const POST = withMcpAuth(async (actor, req) => {
  const input = createInput.parse(await req.json());
  if (input.folderId) {
    const folders = await getWikiFolders();
    if (!folders.some((folder) => folder.id === input.folderId)) {
      return fail(`wiki folder not found: ${input.folderId}`, 404);
    }
  }
  // 본문은 생성과 한 번에 쓴다(빈 리비전·'수정' 활동 없이).
  const content =
    input.contentJson ??
    (input.body?.trim() ? markdownToDoc(input.body) : undefined);
  const created = await createWikiPageCore(
    actor,
    {
      title: input.title,
      parentId: input.parentId ?? null,
      folderId: input.folderId ?? null,
    },
    { content },
  );

  return ok({ id: created.id }, 201);
});

export const GET = withMcpAuth(async (_actor, req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("query") ?? "";
  const limit = parseLimit(url.searchParams.get("limit"));
  const rows = await searchWikiPages(query, limit);
  return ok(rows);
});
