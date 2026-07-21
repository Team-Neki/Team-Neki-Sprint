import { withMcpAuth, ok } from "@/server/api/mcp-auth";
import { getSprints } from "@/server/queries";

export const dynamic = "force-dynamic";

export const GET = withMcpAuth(async () => {
  const sprints = await getSprints();
  return ok(
    sprints.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      startDate: s.startDate,
      endDate: s.endDate,
      estimatedMd: s.estimatedMd,
    })),
  );
});
