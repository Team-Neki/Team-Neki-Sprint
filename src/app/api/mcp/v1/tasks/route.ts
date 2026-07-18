import { z } from "zod";
import { withMcpAuth, ok, fail, parseLimit } from "@/server/api/mcp-auth";
import { createTaskCore } from "@/server/actions/tasks";
import { searchTasks } from "@/server/queries";
import { resolveTeamId, resolveUserId } from "@/lib/issue-key";
import { formatIssueKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

const createInput = z.object({
  title: z.string().trim().min(1),
  team: z.string().trim().min(1), // team id or key
  description: z.string().nullish(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "DONE"]).nullish(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).nullish(),
  assignee: z.string().trim().nullish(), // user id or email
  epicId: z.string().trim().nullish(),
  startDate: z.string().trim().nullish(),
  dueDate: z.string().trim().nullish(),
  estimatedMd: z.number().nullish(),
});

export const POST = withMcpAuth(async (actor, req) => {
  const body = createInput.parse(await req.json());

  const teamId = await resolveTeamId(body.team);
  if (!teamId) return fail(`unknown team: ${body.team}`, 422);

  let assigneeId: string | null = null;
  if (body.assignee) {
    assigneeId = await resolveUserId(body.assignee);
    if (!assigneeId) return fail(`unknown assignee: ${body.assignee}`, 422);
  }

  const created = await createTaskCore(actor, {
    title: body.title,
    teamId,
    description: body.description ?? null,
    status: body.status ?? undefined,
    priority: body.priority ?? undefined,
    assigneeId,
    epicId: body.epicId ?? null,
    startDate: body.startDate ?? null,
    dueDate: body.dueDate ?? null,
    estimatedMd: body.estimatedMd ?? null,
  });

  return ok({ id: created.id }, 201);
});

export const GET = withMcpAuth(async (_actor, req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("query") ?? "";
  const limit = parseLimit(url.searchParams.get("limit"));
  const rows = await searchTasks(query, limit);
  return ok(
    rows.map((t) => ({
      id: t.id,
      key: formatIssueKey(t.team?.key, t.number),
      title: t.title,
      status: t.status,
    })),
  );
});
