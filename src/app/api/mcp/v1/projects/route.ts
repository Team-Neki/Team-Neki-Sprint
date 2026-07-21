import { withMcpAuth, ok } from "@/server/api/mcp-auth";
import { getProjects } from "@/server/queries";

export const dynamic = "force-dynamic";

export const GET = withMcpAuth(async () => {
  const projects = await getProjects();
  return ok(
    projects.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      priority: p.priority,
      owner: p.owner ? { id: p.owner.id, name: p.owner.name } : null,
      sprint: p.sprint
        ? { id: p.sprint.id, name: p.sprint.name, status: p.sprint.status }
        : null,
      epicCount: p._count.epics,
      startDate: p.startDate,
      dueDate: p.dueDate,
    })),
  );
});
