import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SprintClient } from "../client.js";
import type { Config } from "../config.js";
import { deepLink } from "../format.js";

/**
 * 위키 본문(body) 마크다운 작성 규칙. 서버 변환기(src/lib/text-to-doc.ts)가 지원하는 문법과
 * 맞춰 둔다 — 지원하지 않는 문법은 글자 문단으로 남아 위키에서 깨져 보인다.
 */
export const WIKI_MARKDOWN_GUIDE =
  "'body' markdown supports: # headings, paragraphs, **bold** / *italic* / `code` / [links](url), " +
  "bullet / numbered / task (- [ ] / - [x]) lists nested by indenting 2 spaces, > blockquotes, --- rules, " +
  "pipe tables (| a | b | header row, then |---|---|, then rows), and fenced code. " +
  "Draw every diagram (flow, architecture, sequence, state, ER) as a ```mermaid fence - it renders as a diagram. " +
  "Never draw diagrams as ASCII art in a code block, and never use HTML tags.";

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
        "Create a wiki page. " +
        WIKI_MARKDOWN_GUIDE +
        " contentJson (Tiptap doc) takes precedence over body; use it only for content markdown cannot express. Resolve folderId with list_wiki_folders. Optional parentId/folderId to nest.",
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
        "Update a wiki page's title and/or body or contentJson (Tiptap doc, takes precedence). Content replaces the page body. " +
        WIKI_MARKDOWN_GUIDE,
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
