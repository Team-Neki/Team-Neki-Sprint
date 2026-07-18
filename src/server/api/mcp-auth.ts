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

/**
 * 라우트 핸들러가 의도적으로 던지는 4xx 오류(참조 없음 등). 이 예외의 message 만
 * 클라이언트에 노출되고, 그 외 예외는 내부정보 유출 방지를 위해 500 internal_error 로 마스킹된다.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** `?limit=` 를 1–max 정수로 정규화. 음수/소수/비수치는 기본값 또는 경계로 클램프. */
export function parseLimit(raw: string | null, def = 20, max = 50): number {
  const n = Number(raw ?? def);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(1, Math.floor(n)), max);
}

type RouteCtx = { params: Promise<Record<string, string>> };
type RouteHandler = (req: Request, ctx: RouteCtx) => Promise<Response>;
type AuthedHandler = (
  actor: Actor,
  req: Request,
  ctx: RouteCtx,
) => Promise<Response>;

/**
 * Wrap a route handler with bearer-token auth + uniform error handling.
 * 인증(authenticateBearer)까지 try 안에 두어 DB 장애도 공통 처리되며, ZodError 는 400,
 * 명시적 HttpError 는 그 상태로, 나머지 미상 예외는 내부정보 마스킹 후 500 으로 반환한다.
 */
export function withMcpAuth(handler: AuthedHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      const actor = await authenticateBearer(req.headers.get("authorization"));
      if (!actor) return fail("unauthorized", 401);
      return await handler(actor, req, ctx);
    } catch (e) {
      if (e instanceof ZodError)
        return fail("validation_error", 400, flattenError(e));
      if (e instanceof HttpError) return fail(e.message, e.status);
      // 미상/예상외 예외(DB, 버그): 내부 메시지 노출 금지 + 재시도 가능한 서버오류로 신호.
      console.error("[mcp-api] unhandled error:", e);
      return fail("internal_error", 500);
    }
  };
}
