import { withMcpAuth, ok } from "@/server/api/mcp-auth";
import { getWikiFolders } from "@/server/queries";

export const dynamic = "force-dynamic";

// Return every folder so clients can resolve names through the full parent chain.
export const GET = withMcpAuth(async () => ok(await getWikiFolders()));
