import { z } from "zod";
import { withMcpAuth, ok, fail } from "@/server/api/mcp-auth";
import { updateEpicFieldsCore, deleteEpicCore } from "@/server/actions/epics";
import { getEpic } from "@/server/queries";
import { resolveEpicId, resolveUserId } from "@/lib/issue-key";
import { formatIssueKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const GET = withMcpAuth(async (_actor, _req, ctx) => {
  const { idOrKey } = await ctx.params;
  const id = await resolveEpicId(idOrKey);
  if (!id) return fail(`epic not found: ${idOrKey}`, 404);
  const epic = await getEpic(id);
  if (!epic) return fail(`epic not found: ${idOrKey}`, 404);
  return ok({
    id: epic.id,
    key: formatIssueKey(epic.team?.key, epic.number),
    title: epic.title,
    description: epic.description,
    status: epic.status,
    priority: epic.priority,
    owner: epic.owner ? { id: epic.owner.id, name: epic.owner.name } : null,
    team: epic.team ? { id: epic.team.id, key: epic.team.key } : null,
    project: epic.project
      ? { id: epic.project.id, title: epic.project.title }
      : null,
    startDate: epic.startDate,
    dueDate: epic.dueDate,
    estimatedMd: epic.md.estimated,
    actualMd: epic.md.actual,
    tasks: epic.tasks.map((t) => ({
      id: t.id,
      key: formatIssueKey(t.team?.key, t.number),
      title: t.title,
      status: t.status,
      priority: t.priority,
      assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name } : null,
    })),
  });
});

const patchInput = z.object({
  title: z.string().trim().min(1).nullish(),
  description: z.string().nullish(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).nullish(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).nullish(),
  owner: z.string().trim().nullish(), // user id or email
  projectId: z.string().trim().nullish(),
  startDate: z.string().trim().nullish(),
  dueDate: z.string().trim().nullish(),
});

export const PATCH = withMcpAuth(async (actor, req, ctx) => {
  const { idOrKey } = await ctx.params;
  const id = await resolveEpicId(idOrKey);
  if (!id) return fail(`epic not found: ${idOrKey}`, 404);

  const body = patchInput.parse(await req.json());
  const patch: Record<string, unknown> = {};
  if (body.title != null) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.status != null) patch.status = body.status;
  if (body.priority != null) patch.priority = body.priority;
  if (body.projectId !== undefined) patch.projectId = body.projectId;
  if (body.startDate !== undefined) patch.startDate = body.startDate;
  if (body.dueDate !== undefined) patch.dueDate = body.dueDate;
  if (body.owner !== undefined) {
    if (body.owner === null) {
      patch.ownerId = null;
    } else {
      const uid = await resolveUserId(body.owner);
      if (!uid) return fail(`unknown owner: ${body.owner}`, 422);
      patch.ownerId = uid;
    }
  }

  await updateEpicFieldsCore(actor, id, patch);
  return ok({ id });
});

export const DELETE = withMcpAuth(async (actor, _req, ctx) => {
  const { idOrKey } = await ctx.params;
  const id = await resolveEpicId(idOrKey);
  if (!id) return fail(`epic not found: ${idOrKey}`, 404);
  // 삭제 권한(소유자/ADMIN)은 deleteEpicCore 의 assertCanManage 가 검사한다(위반 시 403).
  await deleteEpicCore(actor, id);
  return ok({ id });
});
