import { NextResponse } from "next/server";
import { ZodError, flattenError } from "zod";
import type { Actor } from "@/lib/authz";
import { authenticateBearer } from "@/lib/api-token";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(error: string, status = 400, extra?: unknown) {
  return NextResponse.json(
    { ok: false, error, ...(extra ? { issues: extra } : {}) },
    { status },
  );
}

type RouteCtx = { params: Promise<Record<string, string>> };
type RouteHandler = (req: Request, ctx: RouteCtx) => Promise<Response>;
type AuthedHandler = (
  actor: Actor,
  req: Request,
  ctx: RouteCtx,
) => Promise<Response>;

/** Wrap a route handler with bearer-token auth + uniform error handling. */
export function withMcpAuth(handler: AuthedHandler): RouteHandler {
  return async (req, ctx) => {
    const actor = await authenticateBearer(req.headers.get("authorization"));
    if (!actor) return fail("unauthorized", 401);
    try {
      return await handler(actor, req, ctx);
    } catch (e) {
      if (e instanceof ZodError)
        return fail("validation_error", 400, flattenError(e));
      const message = e instanceof Error ? e.message : "internal_error";
      return fail(message, 400);
    }
  };
}
