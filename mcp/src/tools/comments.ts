import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SprintClient } from "../client.js";

export function registerCommentTools(server: McpServer, client: SprintClient) {
  server.registerTool(
    "add_comment",
    {
      description:
        "Add a comment to a task, epic, project, or sprint. 'idOrKey' accepts an issue key (e.g. NEKI-42) for task/epic, an id for project/sprint. 'body' is a markdown subset (headings/lists/code/bold/italic/links). The comment is attributed to the token owner.",
      inputSchema: {
        entityType: z.enum(["task", "epic", "project", "sprint"]),
        idOrKey: z.string(),
        body: z.string().describe("Comment body (markdown subset)"),
      },
    },
    async (args) => {
      const data = await client.post<{
        entityType: string;
        entityId: string;
      }>("/api/mcp/v1/comments", args);
      return {
        content: [
          {
            type: "text",
            text: `Commented on ${data.entityType} ${data.entityId}`,
          },
        ],
      };
    },
  );
}
