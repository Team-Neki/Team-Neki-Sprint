import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SprintClient } from "../client.js";
import type { Config } from "../config.js";
import { deepLink } from "../format.js";

export function registerWikiTools(
  server: McpServer,
  client: SprintClient,
  cfg: Config,
) {
  server.registerTool(
    "list_wiki_folders",
    {
      description:
        "List all wiki folders (id, name, parentId, position). Resolve the requested path through parentId before passing folderId to create_wiki_page. Do not guess when a path is missing or ambiguous.",
      inputSchema: {},
    },
    async () => {
      const data = await client.get("/api/mcp/v1/wiki/folders");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    "create_wiki_page",
    {
      description:
        "Create a wiki page. 'body' is markdown; use contentJson (Tiptap doc) to preserve tables and rich content (takes precedence over body). Resolve folderId with list_wiki_folders. Optional parentId/folderId to nest.",
      inputSchema: {
        title: z.string(),
        body: z.string().nullish(),
        contentJson: z.object({ type: z.literal("doc"), content: z.array(z.unknown()).optional() }).passthrough().nullish(),
        parentId: z.string().nullish(),
        folderId: z.string().nullish(),
      },
    },
    async (args) => {
      const data = await client.post<{ id: string }>("/api/mcp/v1/wiki", args);
      return {
        content: [
          {
            type: "text",
            text: `Created wiki page ${data.id}\n${deepLink(cfg.apiUrl, "wiki", data.id)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "update_wiki_page",
    {
      description:
        "Update a wiki page's title and/or body (markdown) or contentJson (Tiptap doc, takes precedence). Content replaces the page body.",
      inputSchema: {
        id: z.string(),
        title: z.string().nullish(),
        body: z.string().nullish(),
        contentJson: z.object({ type: z.literal("doc"), content: z.array(z.unknown()).optional() }).passthrough().nullish(),
      },
    },
    async ({ id, ...patch }) => {
      const data = await client.patch<{ id: string }>(
        `/api/mcp/v1/wiki/${encodeURIComponent(id)}`,
        patch,
      );
      return {
        content: [
          {
            type: "text",
            text: `Updated wiki page ${data.id}\n${deepLink(cfg.apiUrl, "wiki", data.id)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_wiki_page",
    {
      description: "Get a wiki page by id (returns plain text, Tiptap JSON, folderId and parentId).",
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const data = await client.get(
        `/api/mcp/v1/wiki/${encodeURIComponent(id)}`,
      );
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    "search_wiki_pages",
    {
      description: "Search wiki pages by title.",
      inputSchema: { query: z.string(), limit: z.number().nullish() },
    },
    async ({ query, limit }) => {
      const qs = new URLSearchParams({ query });
      if (limit) qs.set("limit", String(limit));
      const data = await client.get(`/api/mcp/v1/wiki?${qs.toString()}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );
}
