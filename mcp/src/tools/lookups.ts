import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SprintClient } from "../client.js";

export function registerLookupTools(server: McpServer, client: SprintClient) {
  const simple = (name: string, path: string, description: string) =>
    server.registerTool(name, { description, inputSchema: {} }, async () => {
      const data = await client.get(path);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    });

  simple(
    "list_teams",
    "/api/mcp/v1/teams",
    "List teams (id, key, name) to resolve a team for create_ticket.",
  );
  simple(
    "list_members",
    "/api/mcp/v1/members",
    "List members (id, name, email) to resolve an assignee.",
  );
  simple(
    "list_epics",
    "/api/mcp/v1/epics",
    "List epics (id, key, title) to resolve an epicId.",
  );
}
