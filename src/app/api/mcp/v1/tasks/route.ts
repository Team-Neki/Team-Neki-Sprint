import { z } from "zod";
import type { Status } from "@prisma/client";
import { withMcpAuth, ok, fail, parseLimit } from "@/server/api/mcp-auth";
import { createTaskCore } from "@/server/actions/tasks";
import { getTasks, searchTasks } from "@/server/queries";
import {
  resolveEpicId,
  resolveTeamId,
  resolveUserId,
} from "@/lib/issue-key";
import { formatIssueKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

const createInput = z.object({
  title: z.string().trim().min(1),
  team: z.string().trim().min(1), // team id or key
  description: z.string().nullish(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).nullish(),
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

const STATUS_VALUES = ["TODO", "IN_PROGRESS", "DONE"] as const;

export const GET = withMcpAuth(async (_actor, req) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("query") ?? "";
  const limit = parseLimit(url.searchParams.get("limit"));

  // 구조화 필터(epic/status/assignee/team)가 하나라도 있으면 필터 목록 조회,
  // 없으면 기존 제목/키 검색(searchTasks) — search_tickets 하위호환.
  const epic = url.searchParams.get("epic");
  const status = url.searchParams.get("status");
  const assignee = url.searchParams.get("assignee");
  const team = url.searchParams.get("team");
  if (epic == null && status == null && assignee == null && team == null) {
    const rows = await searchTasks(query, limit);
    return ok(
      rows.map((t) => ({
        id: t.id,
        key: formatIssueKey(t.team?.key, t.number),
        title: t.title,
        status: t.status,
      })),
    );
  }

  let epicId: string | undefined;
  if (epic != null) {
    const resolved = await resolveEpicId(epic);
    if (!resolved) return fail(`unknown epic: ${epic}`, 422);
    epicId = resolved;
  }
  if (status != null && !STATUS_VALUES.includes(status as Status)) {
    return fail(`unknown status: ${status}`, 422);
  }
  let assigneeId: string | undefined;
  if (assignee != null) {
    const resolved = await resolveUserId(assignee);
    if (!resolved) return fail(`unknown assignee: ${assignee}`, 422);
    assigneeId = resolved;
  }
  let teamId: string | undefined;
  if (team != null) {
    const resolved = await resolveTeamId(team);
    if (!resolved) return fail(`unknown team: ${team}`, 422);
    teamId = resolved;
  }

  const rows = await getTasks({
    epicId,
    status: status != null ? [status as Status] : undefined,
    assigneeId: assigneeId ? [assigneeId] : undefined,
    teamId: teamId ? [teamId] : undefined,
    q: query || undefined,
  });
  return ok(
    rows.slice(0, limit).map((t) => ({
      id: t.id,
      key: formatIssueKey(t.team?.key, t.number),
      title: t.title,
      status: t.status,
      priority: t.priority,
      assignee: t.assignee
        ? { id: t.assignee.id, name: t.assignee.name }
        : null,
      epic: t.epic ? { id: t.epic.id, title: t.epic.title } : null,
    })),
  );
});
