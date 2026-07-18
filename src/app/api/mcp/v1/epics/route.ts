import { withMcpAuth, ok } from "@/server/api/mcp-auth";
import { getEpicOptions } from "@/server/queries";
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
