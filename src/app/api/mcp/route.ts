import { authenticateBearer } from "@/lib/api-token";
import { GET as listTasks, POST as createTask } from "@/app/api/mcp/v1/tasks/route";
import { GET as getTask, PATCH as updateTask } from "@/app/api/mcp/v1/tasks/[idOrKey]/route";

// Stateless Streamable HTTP JSON-RPC endpoint. Existing /api/mcp/v1/* REST handlers
// remain the source of truth for validation, authorization and business logic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERSION = "2025-03-26";
type RpcId = string | number | null;
type RpcRequest = { jsonrpc?: string; id?: RpcId; method?: string; params?: unknown };
type ToolArgs = Record<string, unknown>;
type Tool = { name: string; description: string; inputSchema: Record<string, unknown> };

const tools: Tool[] = [
  {
    name: "get_ticket",
    description: "Get a Sprint ticket by id or issue key (e.g. NEKI-42).",
    inputSchema: { type: "object", properties: { idOrKey: { type: "string" } }, required: ["idOrKey"] },
  },
  {
    name: "search_tickets",
    description: "Search Sprint tickets by title or key; filter by team, epic, assignee and status.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 },
        epic: { type: "string" }, status: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"] },
        assignee: { type: "string" }, team: { type: "string" },
      },
    },
  },
  {
    name: "create_ticket",
    description: "Create a Sprint ticket. The team is a team key (e.g. NEKI) or id.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" }, team: { type: "string" }, description: { type: "string" },
        status: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"] },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
        assignee: { type: "string" }, epicId: { type: "string" },
        startDate: { type: "string" }, dueDate: { type: "string" }, estimatedMd: { type: "number" },
      },
      required: ["title", "team"],
    },
  },
  {
    name: "update_ticket",
    description: "Update an existing Sprint ticket, setting only the supplied fields.",
    inputSchema: {
      type: "object",
      properties: {
        idOrKey: { type: "string" }, title: { type: "string" }, description: { type: "string" },
        status: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"] },
        priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
        assignee: { type: "string" }, epicId: { type: "string" },
        startDate: { type: "string" }, dueDate: { type: "string" }, estimatedMd: { type: "number" },
      },
      required: ["idOrKey"],
    },
  },
];

const responseHeaders = {
  "Cache-Control": "no-store",
  "MCP-Protocol-Version": VERSION,
};

function rpc(id: RpcId, result: unknown, status = 200): Response {
  return Response.json({ jsonrpc: "2.0", id, result }, { status, headers: responseHeaders });
}

function error(id: RpcId, code: number, message: string, status = 200): Response {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status, headers: responseHeaders });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredString(args: ToolArgs, key: string): string | null {
  return typeof args[key] === "string" && (args[key] as string).trim() ? args[key] as string : null;
}

async function invokeTool(name: string, args: ToolArgs, req: Request) {
  const url = new URL(req.url);
  const headers = { authorization: req.headers.get("authorization") ?? "" };
  let response: Response;

  if (name === "get_ticket" || name === "update_ticket") {
    const id = requiredString(args, "idOrKey");
    if (!id) throw new Error("idOrKey must be a nonempty string");
    url.pathname = `/api/mcp/v1/tasks/${encodeURIComponent(id)}`;
    if (name === "get_ticket") {
      response = await getTask(new Request(url, { headers }), { params: Promise.resolve({ idOrKey: id }) });
    } else {
      const { idOrKey: _idOrKey, ...patch } = args;
      response = await updateTask(new Request(url, {
        method: "PATCH", headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(patch),
      }), { params: Promise.resolve({ idOrKey: id }) });
    }
  } else if (name === "search_tickets") {
    url.pathname = "/api/mcp/v1/tasks";
    url.search = "";
    for (const key of ["query", "limit", "epic", "status", "assignee", "team"]) {
      const value = args[key];
      if (typeof value === "string" || (key === "limit" && typeof value === "number")) {
        url.searchParams.set(key, String(value));
      }
    }
    response = await listTasks(new Request(url, { headers }), { params: Promise.resolve({}) });
  } else if (name === "create_ticket") {
    if (!requiredString(args, "title") || !requiredString(args, "team")) {
      throw new Error("title and team must be nonempty strings");
    }
    url.pathname = "/api/mcp/v1/tasks";
    response = await createTask(new Request(url, {
      method: "POST", headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(args),
    }), { params: Promise.resolve({}) });
  } else {
    throw new Error("Unknown tool");
  }

  const payload: unknown = await response.json();
  const failed = !response.ok || (isObject(payload) && payload.ok === false);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(isObject(payload) && payload.ok === true ? payload.data : payload) }],
    isError: failed,
  };
}

export async function POST(req: Request): Promise<Response> {
  // Authenticate *before* processing methods, including tool discovery.
  // Each HTTP request carries its own PAT; no server-wide shared identity.
  try {
    if (!await authenticateBearer(req.headers.get("authorization"))) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { ...responseHeaders, "WWW-Authenticate": 'Bearer realm="Sprint MCP"' },
      });
    }
  } catch (cause) {
    console.error("[mcp-http] authentication failed", cause);
    return new Response("Internal Server Error", { status: 500, headers: responseHeaders });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return error(null, -32700, "Parse error", 400); }
  if (!isObject(body) || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return error(null, -32600, "Invalid Request", 400);
  }
  const message = body as RpcRequest;
  if (message.id === undefined) {
    // JSON-RPC notifications have no response body.
    return new Response(null, { status: 202, headers: responseHeaders });
  }
  const id = message.id;
  if (id !== null && typeof id !== "string" && typeof id !== "number") {
    return error(null, -32600, "Invalid id", 400);
  }

  switch (message.method) {
    case "initialize":
      return rpc(id, {
        protocolVersion: VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "team-neki-sprint", version: "0.1.0" },
      });
    case "ping":
      return rpc(id, {});
    case "tools/list":
      return rpc(id, { tools });
    case "tools/call": {
      const params = message.params;
      if (!isObject(params) || typeof params.name !== "string" || !tools.some(t => t.name === params.name)) {
        return error(id, -32602, "Unknown tool or invalid parameters");
      }
      if (params.arguments !== undefined && !isObject(params.arguments)) {
        return error(id, -32602, "arguments must be an object");
      }
      try {
        return rpc(id, await invokeTool(params.name, (params.arguments ?? {}) as ToolArgs, req));
      } catch (cause) {
        console.error("[mcp-http] tool execution failed", cause);
        return rpc(id, { content: [{ type: "text", text: cause instanceof Error && cause.message.startsWith("Unknown") ? cause.message : "Tool execution failed" }], isError: true });
      }
    }
    default:
      return error(id, -32601, "Method not found");
  }
}

export function GET(): Response {
  return new Response("Method Not Allowed: use POST for stateless MCP", {
    status: 405, headers: { ...responseHeaders, Allow: "POST" },
  });
}

export function DELETE(): Response {
  return new Response("Method Not Allowed: stateless MCP has no sessions", {
    status: 405, headers: { ...responseHeaders, Allow: "POST" },
  });
}
