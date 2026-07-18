import { z } from "zod";
import { withMcpAuth, ok, parseLimit } from "@/server/api/mcp-auth";
import { createWikiPageCore, updateWikiContentCore } from "@/server/actions/wiki";
import { searchWikiPages } from "@/server/queries";
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
  const created = await createWikiPageCore(actor, {
    title: input.title,
    parentId: input.parentId ?? null,
    folderId: input.folderId ?? null,
  });

  if (input.contentJson != null || (input.body && input.body.trim())) {
    const content = input.contentJson ?? markdownToDoc(input.body ?? "");
    await updateWikiContentCore(actor, created.id, input.title, content);
  }

  return ok({ id: created.id }, 201);
});

export const GET = withMcpAuth(async (_actor, req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("query") ?? "";
  const limit = parseLimit(url.searchParams.get("limit"));
  const rows = await searchWikiPages(query, limit);
  return ok(rows);
});
