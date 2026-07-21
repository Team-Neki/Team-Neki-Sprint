import { z } from "zod";
import { withMcpAuth, ok, fail } from "@/server/api/mcp-auth";
import { updateTaskFieldsCore, deleteTaskCore } from "@/server/actions/tasks";
import { getTask } from "@/server/queries";
import { resolveTaskId, resolveUserId } from "@/lib/issue-key";
import { formatIssueKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

const patchInput = z.object({
  title: z.string().trim().min(1).nullish(),
  description: z.string().nullish(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).nullish(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).nullish(),
  assignee: z.string().trim().nullish(),
  epicId: z.string().trim().nullish(),
  startDate: z.string().trim().nullish(),
  dueDate: z.string().trim().nullish(),
  estimatedMd: z.number().nullish(),
});

export const GET = withMcpAuth(async (_actor, _req, ctx) => {
  const { idOrKey } = await ctx.params;
  const id = await resolveTaskId(idOrKey);
  if (!id) return fail(`task not found: ${idOrKey}`, 404);
  const task = await getTask(id);
  if (!task) return fail(`task not found: ${idOrKey}`, 404);
  return ok({
    id: task.id,
    key: formatIssueKey(task.team?.key, task.number),
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee
      ? { id: task.assignee.id, name: task.assignee.name }
      : null,
    epic: task.epic ? { id: task.epic.id, title: task.epic.title } : null,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimatedMd: task.estimatedMd,
  });
});

export const PATCH = withMcpAuth(async (actor, req, ctx) => {
  const { idOrKey } = await ctx.params;
  const id = await resolveTaskId(idOrKey);
  if (!id) return fail(`task not found: ${idOrKey}`, 404);

  const body = patchInput.parse(await req.json());
  const patch: Record<string, unknown> = {};
  if (body.title != null) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.status != null) patch.status = body.status;
  if (body.priority != null) patch.priority = body.priority;
  if (body.epicId !== undefined) patch.epicId = body.epicId;
  if (body.startDate !== undefined) patch.startDate = body.startDate;
  if (body.dueDate !== undefined) patch.dueDate = body.dueDate;
  if (body.estimatedMd !== undefined) patch.estimatedMd = body.estimatedMd;
  if (body.assignee !== undefined) {
    if (body.assignee === null) {
      patch.assigneeId = null;
    } else {
      const uid = await resolveUserId(body.assignee);
      if (!uid) return fail(`unknown assignee: ${body.assignee}`, 422);
      patch.assigneeId = uid;
    }
  }

  await updateTaskFieldsCore(actor, id, patch);
  return ok({ id });
});

export const DELETE = withMcpAuth(async (actor, _req, ctx) => {
  const { idOrKey } = await ctx.params;
  const id = await resolveTaskId(idOrKey);
  if (!id) return fail(`task not found: ${idOrKey}`, 404);
  // 삭제 권한(작성자/담당자/ADMIN)은 deleteTaskCore 의 assertCanManage 가 검사한다(위반 시 403).
  await deleteTaskCore(actor, id);
  return ok({ id });
});
