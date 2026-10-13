import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { SprintClient } from "../client.js";
import { registerWikiTools } from "./wiki.js";

const cfg = { apiUrl: "https://sprint.test", token: "test-token" };

async function setup() {
  const calls: { method: string; url: string; body: unknown; contentType: string | null }[] = [];
  let n = 0;
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    let body: unknown = undefined;
    if (init?.body instanceof FormData) {
      const f = init.body.get("file") as File;
      body = { name: f.name, size: f.size };
    } else if (init?.body) body = JSON.parse(String(init.body));
    calls.push({ method, url, body, contentType: headers.get("content-type") });
    let data: unknown = { id: "page" };
    if (url.endsWith("/wiki/files")) {
      n += 1;
      const b = body as { name: string; size: number };
      data = { id: `f${n}`, url: `/api/wiki/file/f${n}`, name: b.name, size: b.size, mimeType: "application/octet-stream" };
    } else if (method === "GET") {
      data = { id: "page", content: { type: "doc", content: [{ type: "paragraph" }] } };
    }
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  }) as typeof fetch;
  const server = new McpServer({ name: "test", version: "1" });
  registerWikiTools(server, new SprintClient(cfg, fakeFetch), cfg);
  const client = new Client({ name: "test-client", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  return { client, calls, close: async () => { await client.close(); await server.close(); } };
}

describe("upload_wiki_file", () => {
  it("uploads each file as multipart and appends attachment nodes in one page edit", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sprint-mcp-"));
    const p1 = join(dir, "a.p12");
    const p2 = join(dir, "b.mobileprovision");
    await writeFile(p1, Buffer.from([1, 2, 3]));
    await writeFile(p2, "xy");
    const s = await setup();
    try {
      await s.client.callTool({ name: "upload_wiki_file", arguments: { paths: [p1, p2], pageId: "page" } });
      const uploads = s.calls.filter((c) => c.url.endsWith("/wiki/files"));
      expect(uploads.map((c) => c.body)).toEqual([{ name: "a.p12", size: 3 }, { name: "b.mobileprovision", size: 2 }]);
      // multipart 는 fetch 가 boundary 를 붙이도록 content-type 을 직접 지정하지 않는다.
      expect(uploads.every((c) => c.contentType === null)).toBe(true);
      const patches = s.calls.filter((c) => c.method === "PATCH");
      expect(patches).toHaveLength(1);
      expect(patches[0].body).toEqual({ contentJson: { type: "doc", content: [
        { type: "paragraph" },
        { type: "fileAttachment", attrs: { id: "f1", name: "a.p12", size: 3, mime: "application/octet-stream" } },
        { type: "fileAttachment", attrs: { id: "f2", name: "b.mobileprovision", size: 2, mime: "application/octet-stream" } },
      ] } });
    } finally { await s.close(); }
  });

  it("only uploads when pageId is omitted", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sprint-mcp-"));
    const p = join(dir, "a.txt");
    await writeFile(p, "x");
    const s = await setup();
    try {
      const r = await s.client.callTool({ name: "upload_wiki_file", arguments: { paths: [p] } });
      expect(s.calls.map((c) => c.method)).toEqual(["POST"]);
      expect(JSON.stringify(r.content)).toContain("fileAttachment");
    } finally { await s.close(); }
  });
});
