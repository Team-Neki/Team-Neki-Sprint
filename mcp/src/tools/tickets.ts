import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SprintClient } from "../client.js";
import type { Config } from "../config.js";
import { deepLink } from "../format.js";

const STATUS = z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "DONE"]);
const PRIORITY = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export function registerTicketTools(
  server: McpServer,
  client: SprintClient,
  cfg: Config,
) {
  server.registerTool(
    "create_ticket",
    {
      description:
        "Create a ticket (task). 'team' accepts a team key like NEKI or a team id. 'assignee' accepts an email or user id.",
      inputSchema: {
        title: z.string().describe("Ticket title"),
        team: z.string().describe("Team key (e.g. NEKI) or team id"),
        description: z.string().nullish(),
        status: STATUS.nullish(),
        priority: PRIORITY.nullish(),
        assignee: z.string().nullish().describe("Assignee email or user id"),
        epicId: z.string().nullish(),
        startDate: z.string().nullish().describe("ISO date"),
        dueDate: z.string().nullish().describe("ISO date"),
        estimatedMd: z.number().nullish(),
      },
    },
    async (args) => {
      const data = await client.post<{ id: string }>(
        "/api/mcp/v1/tasks",
        args,
      );
      return {
        content: [
          {
            type: "text",
            text: `Created ticket ${data.id}\n${deepLink(cfg.apiUrl, "tasks", data.id)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "update_ticket",
    {
      description:
        "Update a ticket by id or issue key (e.g. NEKI-42). Only provided fields change.",
      inputSchema: {
        idOrKey: z.string(),
        title: z.string().nullish(),
        description: z.string().nullish(),
        status: STATUS.nullish(),
        priority: PRIORITY.nullish(),
        assignee: z.string().nullish(),
        epicId: z.string().nullish(),
        startDate: z.string().nullish(),
        dueDate: z.string().nullish(),
        estimatedMd: z.number().nullish(),
      },
    },
    async ({ idOrKey, ...patch }) => {
      const data = await client.patch<{ id: string }>(
        `/api/mcp/v1/tasks/${encodeURIComponent(idOrKey)}`,
        patch,
      );
      return {
        content: [
          {
            type: "text",
            text: `Updated ${data.id}\n${deepLink(cfg.apiUrl, "tasks", data.id)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_ticket",
    {
      description: "Get a ticket by id or issue key (e.g. NEKI-42).",
      inputSchema: { idOrKey: z.string() },
    },
    async ({ idOrKey }) => {
      const data = await client.get(
        `/api/mcp/v1/tasks/${encodeURIComponent(idOrKey)}`,
      );
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    "search_tickets",
    {
      description: "Search tickets by title/key. Returns id, key, title, status.",
      inputSchema: { query: z.string().nullish(), limit: z.number().nullish() },
    },
    async ({ query, limit }) => {
      const qs = new URLSearchParams();
      if (query) qs.set("query", query);
      if (limit) qs.set("limit", String(limit));
      const data = await client.get(`/api/mcp/v1/tasks?${qs.toString()}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
