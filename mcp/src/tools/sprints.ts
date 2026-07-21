import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SprintClient } from "../client.js";

export function registerSprintTools(server: McpServer, client: SprintClient) {
  server.registerTool(
    "list_sprints",
    {
      description:
        "List sprints (id, name, status, startDate, endDate, estimatedMd).",
      inputSchema: {},
    },
    async () => {
      const data = await client.get("/api/mcp/v1/sprints");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_sprint",
    {
      description: "Get a sprint by id, including its projects.",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const data = await client.get(
        `/api/mcp/v1/sprints/${encodeURIComponent(id)}`,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
