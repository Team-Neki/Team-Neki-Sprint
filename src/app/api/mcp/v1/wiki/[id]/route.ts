import { z } from "zod";
import { withMcpAuth, ok, fail } from "@/server/api/mcp-auth";
import { updateWikiContentCore } from "@/server/actions/wiki";
import { getWikiPage } from "@/server/queries";
import { docToPlainText } from "@/lib/rich-content";
import { markdownToDoc } from "@/lib/text-to-doc";
import type { JSONContent } from "@tiptap/core";

export const dynamic = "force-dynamic";

const patchInput = z.object({
  title: z.string().trim().min(1).nullish(),
  body: z.string().nullish(),
  contentJson: z.unknown().nullish(),
});

export const GET = withMcpAuth(async (_actor, _req, ctx) => {
  const { id } = await ctx.params;
  const page = await getWikiPage(id);
  if (!page) return fail(`wiki page not found: ${id}`, 404);
  return ok({
    id: page.id,
    title: page.title,
    text: docToPlainText(page.content as JSONContent),
    content: page.content,
    updatedAt: page.updatedAt,
  });
});

export const PATCH = withMcpAuth(async (actor, req, ctx) => {
  const { id } = await ctx.params;
  const input = patchInput.parse(await req.json());

  const page = await getWikiPage(id);
  if (!page) return fail(`wiki page not found: ${id}`, 404);

  const title = input.title ?? page.title;
  const hasNewContent = input.contentJson != null || input.body != null;
  const content = hasNewContent
    ? (input.contentJson ?? markdownToDoc(input.body ?? ""))
    : page.content;

  await updateWikiContentCore(actor, id, title, content);
  return ok({ id });
});
