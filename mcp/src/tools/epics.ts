import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SprintClient } from "../client.js";
import type { Config } from "../config.js";
import { deepLink } from "../format.js";
import { STATUS, PRIORITY } from "./enums.js";

export function registerEpicTools(
  server: McpServer,
  client: SprintClient,
  cfg: Config,
) {
  server.registerTool(
    "create_epic",
    {
      description:
        "Create an epic. 'team' accepts a team key like NEKI or a team id. 'owner' accepts an email or user id.",
      inputSchema: {
        title: z.string().describe("Epic title"),
        team: z.string().describe("Team key (e.g. NEKI) or team id"),
        description: z.string().nullish(),
        status: STATUS.nullish(),
        priority: PRIORITY.nullish(),
        owner: z.string().nullish().describe("Owner email or user id"),
        projectId: z.string().nullish(),
        startDate: z.string().nullish().describe("ISO date"),
        dueDate: z.string().nullish().describe("ISO date"),
      },
    },
    async (args) => {
      const data = await client.post<{ id: string }>("/api/mcp/v1/epics", args);
      return {
        content: [
          {
            type: "text",
            text: `Created epic ${data.id}\n${deepLink(cfg.apiUrl, "epics", data.id)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_epic",
    {
      description:
        "Get an epic by id or issue key (e.g. NEKI-14), including its child tasks.",
      inputSchema: { idOrKey: z.string() },
    },
    async ({ idOrKey }) => {
      const data = await client.get(
        `/api/mcp/v1/epics/${encodeURIComponent(idOrKey)}`,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  server.registerTool(
    "update_epic",
    {
      description:
        "Update an epic by id or issue key (e.g. NEKI-14). Only provided fields change.",
      inputSchema: {
        idOrKey: z.string(),
        title: z.string().nullish(),
        description: z.string().nullish(),
        status: STATUS.nullish(),
        priority: PRIORITY.nullish(),
        owner: z.string().nullish().describe("Owner email or user id"),
        projectId: z.string().nullish(),
        startDate: z.string().nullish(),
        dueDate: z.string().nullish(),
      },
    },
    async ({ idOrKey, ...patch }) => {
      const data = await client.patch<{ id: string }>(
        `/api/mcp/v1/epics/${encodeURIComponent(idOrKey)}`,
        patch,
      );
      return {
        content: [
          {
            type: "text",
            text: `Updated epic ${data.id}\n${deepLink(cfg.apiUrl, "epics", data.id)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "delete_epic",
    {
      description:
        "Delete an epic by id or issue key. DESTRUCTIVE and irreversible - confirm with the user before calling. Only the epic owner or an ADMIN token can delete (403 otherwise). Child tasks are not deleted; they lose the epic link.",
      inputSchema: { idOrKey: z.string() },
    },
    async ({ idOrKey }) => {
      const data = await client.del<{ id: string }>(
        `/api/mcp/v1/epics/${encodeURIComponent(idOrKey)}`,
      );
      return {
        content: [{ type: "text", text: `Deleted epic ${data.id}` }],
      };
    },
  );
}
