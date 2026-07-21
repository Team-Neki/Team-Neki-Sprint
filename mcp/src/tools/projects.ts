import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SprintClient } from "../client.js";

export function registerProjectTools(server: McpServer, client: SprintClient) {
  server.registerTool(
    "list_projects",
    {
      description:
        "List projects (id, title, status, priority, owner, sprint, epicCount).",
      inputSchema: {},
    },
    async () => {
      const data = await client.get("/api/mcp/v1/projects");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_project",
    {
      description: "Get a project by id, including its epics with MD rollups.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const data = await client.get(
        `/api/mcp/v1/projects/${encodeURIComponent(id)}`,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
