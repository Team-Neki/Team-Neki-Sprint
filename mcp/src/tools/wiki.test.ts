import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { SprintClient } from "../client.js";
import { registerWikiTools } from "./wiki.js";

const cfg = { apiUrl: "https://sprint.test", token: "test-token" };

async function setup(payload: unknown, status = 200) {
  const requests: { url: string; method: string; body?: unknown; authorization?: string }[] = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      authorization: new Headers(init?.headers).get("authorization") ?? undefined });
    return new Response(JSON.stringify(status === 200 ? { ok: true, data: payload } : { ok: false, error: "unauthorized" }), { status });
  }) as typeof fetch;
  const server = new McpServer({ name: "test", version: "1" });
  registerWikiTools(server, new SprintClient(cfg, fakeFetch), cfg);
  const client = new Client({ name: "test-client", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  return { client, requests, close: async () => { await client.close(); await server.close(); } };
}

describe("wiki MCP tools", () => {
  // 재발 방지: 쓰기 도구 설명이 다이어그램은 mermaid, 표는 파이프 문법을 안내해야 한다
  // (안내가 없으면 AI 가 ASCII 다이어그램·contentJson 누락 표로 써서 위키가 깨져 보였다).
  it("guides writers to mermaid diagrams and pipe tables", async () => {
    const s = await setup({});
    try {
      const tools = (await s.client.listTools()).tools;
      for (const name of ["create_wiki_page", "update_wiki_page"]) {
        const d = tools.find((t) => t.name === name)?.description ?? "";
        expect(d).toContain("```mermaid");
        expect(d).toContain("ASCII");
        expect(d).toContain("| a | b |");
      }
    } finally {
      await s.close();
    }
  });

  it("exposes folder lookup and returns every parent link without choosing a folder", async () => {
    const folders = [{ id: "a", name: "기획", parentId: null, position: 0 },
      { id: "b", name: "同期", parentId: "a", position: 0 },
      { id: "c", name: "同期", parentId: null, position: 1 }];
    const s = await setup(folders);
    try {
      expect((await s.client.listTools()).tools.map(t => t.name)).toContain("list_wiki_folders");
      const result = await s.client.callTool({ name: "list_wiki_folders", arguments: {} });
      expect(result.content).toEqual([{ type: "text", text: JSON.stringify(folders, null, 2) }]);
      expect(s.requests).toEqual([{ url: cfg.apiUrl + "/api/mcp/v1/wiki/folders", method: "GET", body: undefined, authorization: "Bearer test-token" }]);
    } finally { await s.close(); }
  });

  it("surfaces authentication failures instead of returning an empty folder list", async () => {
    const s = await setup(null, 401);
    try {
      const result = await s.client.callTool({ name: "list_wiki_folders", arguments: {} });
      expect(result.isError).toBe(true);
    } finally { await s.close(); }
  });

  it("preserves table JSON and folderId for creation and rich content updates", async () => {
    const s = await setup({ id: "page" });
    const contentJson = { type: "doc", content: [{ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "value" }] }] }] }] }] };
    try {
      await s.client.callTool({ name: "create_wiki_page", arguments: { title: "Title", folderId: "b", contentJson } });
      await s.client.callTool({ name: "update_wiki_page", arguments: { id: "page", contentJson } });
      expect(s.requests[0].body).toEqual({ title: "Title", folderId: "b", contentJson });
      expect(s.requests[1].body).toEqual({ contentJson });
      expect(s.requests[1].method).toBe("PATCH");
    } finally { await s.close(); }
  });

  it("continues accepting markdown-only creation", async () => {
    const s = await setup({ id: "page" });
    try {
      const result = await s.client.callTool({ name: "create_wiki_page", arguments: { title: "Title", body: "# Heading" } });
      expect(result.isError).not.toBe(true);
      expect(s.requests[0].body).toEqual({ title: "Title", body: "# Heading" });
    } finally { await s.close(); }
  });
});
