import { withMcpAuth, ok } from "@/server/api/mcp-auth";
import { getMembers } from "@/server/queries";

export const dynamic = "force-dynamic";

export const GET = withMcpAuth(async () => {
  const members = await getMembers();
  return ok(
    members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      team: m.team?.key ?? null,
    })),
  );
});
