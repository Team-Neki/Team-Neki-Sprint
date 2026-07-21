#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { SprintClient } from "./client.js";
import { registerTicketTools } from "./tools/tickets.js";
import { registerEpicTools } from "./tools/epics.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerSprintTools } from "./tools/sprints.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerWikiTools } from "./tools/wiki.js";
import { registerLookupTools } from "./tools/lookups.js";

async function main() {
  const cfg = loadConfig();
  const client = new SprintClient(cfg);
  const server = new McpServer({ name: "sprint-mcp", version: "0.2.0" });

  registerTicketTools(server, client, cfg);
  registerEpicTools(server, client, cfg);
  registerProjectTools(server, client);
  registerSprintTools(server, client);
  registerCommentTools(server, client);
  registerWikiTools(server, client, cfg);
  registerLookupTools(server, client);

  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  console.error(
    `[sprint-mcp] fatal: ${e instanceof Error ? e.message : String(e)}`,
  );
  process.exit(1);
});
