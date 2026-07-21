import { withMcpAuth, ok, fail } from "@/server/api/mcp-auth";
import { getProject } from "@/server/queries";
import { formatIssueKey } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const GET = withMcpAuth(async (_actor, _req, ctx) => {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return fail(`project not found: ${id}`, 404);
  return ok({
    id: project.id,
    title: project.title,
    description: project.description,
    status: project.status,
    priority: project.priority,
    owner: project.owner
      ? { id: project.owner.id, name: project.owner.name }
      : null,
    sprint: project.sprint
      ? {
          id: project.sprint.id,
          name: project.sprint.name,
          status: project.sprint.status,
        }
      : null,
    startDate: project.startDate,
    dueDate: project.dueDate,
    estimatedMd: project.md.estimated,
    actualMd: project.md.actual,
    epics: project.epics.map((e) => ({
      id: e.id,
      key: formatIssueKey(e.team?.key, e.number),
      title: e.title,
      status: e.status,
      priority: e.priority,
      owner: e.owner ? { id: e.owner.id, name: e.owner.name } : null,
      taskCount: e._count.tasks,
      estimatedMd: e.md.estimated,
      actualMd: e.md.actual,
    })),
  });
});
