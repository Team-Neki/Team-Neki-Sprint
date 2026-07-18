import { withMcpAuth, ok } from "@/server/api/mcp-auth";
import { getTeamOptions } from "@/server/queries";

export const dynamic = "force-dynamic";

export const GET = withMcpAuth(async () => {
  const teams = await getTeamOptions();
  return ok(teams);
});
