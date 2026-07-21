import { withMcpAuth, ok, fail } from "@/server/api/mcp-auth";
import { getSprint } from "@/server/queries";

export const dynamic = "force-dynamic";

export const GET = withMcpAuth(async (_actor, _req, ctx) => {
  const { id } = await ctx.params;
  const sprint = await getSprint(id);
  if (!sprint) return fail(`sprint not found: ${id}`, 404);
  return ok({
    id: sprint.id,
    name: sprint.name,
    description: sprint.description,
    status: sprint.status,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    projects: sprint.projects.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      priority: p.priority,
      owner: p.owner ? { id: p.owner.id, name: p.owner.name } : null,
      epicCount: p._count.epics,
    })),
  });
});
