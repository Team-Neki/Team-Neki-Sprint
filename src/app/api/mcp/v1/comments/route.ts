import { z } from "zod";
import { withMcpAuth, ok, fail } from "@/server/api/mcp-auth";
import { addEntityCommentCore } from "@/server/actions/comments";
import { resolveEpicId, resolveTaskId } from "@/lib/issue-key";
import { markdownToDoc } from "@/lib/text-to-doc";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const createInput = z.object({
  entityType: z.enum(["task", "epic", "project", "sprint"]),
  idOrKey: z.string().trim().min(1), // task/epic 은 이슈키 허용, project/sprint 는 id
  body: z.string().trim().min(1), // markdown subset
});

export const POST = withMcpAuth(async (actor, req) => {
  const input = createInput.parse(await req.json());

  // task/epic 은 이슈키(NEKI-42)도 받는다. project/sprint 는 id 존재만 확인.
  let entityId: string | null = null;
  switch (input.entityType) {
    case "task":
      entityId = await resolveTaskId(input.idOrKey);
      break;
    case "epic":
      entityId = await resolveEpicId(input.idOrKey);
      break;
    case "project":
      entityId = (
        await prisma.project.findUnique({
          where: { id: input.idOrKey },
          select: { id: true },
        })
      )?.id ?? null;
      break;
    case "sprint":
      entityId = (
        await prisma.sprint.findUnique({
          where: { id: input.idOrKey },
          select: { id: true },
        })
      )?.id ?? null;
      break;
  }
  if (!entityId) {
    return fail(`${input.entityType} not found: ${input.idOrKey}`, 404);
  }

  // 댓글 body 는 Tiptap doc JSON 문자열로 저장된다 — 마크다운을 doc 으로 변환.
  const doc = markdownToDoc(input.body);
  await addEntityCommentCore(
    actor,
    input.entityType,
    entityId,
    JSON.stringify(doc),
  );
  return ok({ entityType: input.entityType, entityId }, 201);
});
