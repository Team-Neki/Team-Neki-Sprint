import { z } from "zod";
import { withMcpAuth, ok, fail } from "@/server/api/mcp-auth";
import { createEpicCore } from "@/server/actions/epics";
import { getEpicOptions } from "@/server/queries";
import { resolveTeamId, resolveUserId } from "@/lib/issue-key";
import { formatIssueKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const GET = withMcpAuth(async () => {
  const epics = await getEpicOptions();
  return ok(
    epics.map((e) => ({
      id: e.id,
      key: formatIssueKey(e.team?.key, e.number),
      title: e.title,
    })),
  );
});

const createInput = z.object({
  title: z.string().trim().min(1),
  team: z.string().trim().min(1), // team id or key
  description: z.string().nullish(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).nullish(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).nullish(),
  owner: z.string().trim().nullish(), // user id or email
  projectId: z.string().trim().nullish(),
  startDate: z.string().trim().nullish(),
  dueDate: z.string().trim().nullish(),
});

export const POST = withMcpAuth(async (actor, req) => {
  const body = createInput.parse(await req.json());

  const teamId = await resolveTeamId(body.team);
  if (!teamId) return fail(`unknown team: ${body.team}`, 422);

  let ownerId: string | null = null;
  if (body.owner) {
    ownerId = await resolveUserId(body.owner);
    if (!ownerId) return fail(`unknown owner: ${body.owner}`, 422);
  }

  const created = await createEpicCore(actor, {
    title: body.title,
    teamId,
    description: body.description ?? null,
    status: body.status ?? undefined,
    priority: body.priority ?? undefined,
    ownerId,
    projectId: body.projectId ?? null,
    startDate: body.startDate ?? null,
    dueDate: body.dueDate ?? null,
  });

  return ok({ id: created.id }, 201);
});
