import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 웜업으로 미리 한 번씩 요청할 경로. 비로그인 요청이라 (app) 레이아웃에서 /login 으로
// 리다이렉트되지만, 그 과정에서 라우트 모듈 로드·렌더 경로 JIT 가 끝난다.
const WARM_PATHS = [
  "/login",
  "/dashboard",
  "/tasks",
  "/tasks/warmup",
  "/wiki",
  "/wiki/warmup",
  "/board",
  "/projects",
  "/epics",
  "/sprints",
  "/timeline",
];

let warmup: Promise<unknown> | undefined;
let warmed = false;

function warmUp() {
  const started = performance.now();
  const base = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  return Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    ...WARM_PATHS.map((path) =>
      fetch(base + path, {
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      }).then((res) => res.arrayBuffer()),
    ),
  ]).then(() => {
    warmed = true;
    console.log(`warm-up done in ${Math.round(performance.now() - started)}ms`);
  });
}

// readinessProbe 대상(liveness 는 /api/health). 새 파드가 트래픽을 받기 전에 첫 요청
// 비용(라우트 모듈 로드·렌더 JIT·Prisma 엔진 로드와 DB 연결)을 미리 치른다. 첫 호출에
// 웜업을 시작하고 끝날 때까지 503, 끝나면(일부 실패해도) 200. 웜업 뒤엔 DB 를 건드리지
// 않아 DB 장애가 readiness 로 번져 전 파드가 빠지는 일은 없다.
export function GET() {
  warmup ??= warmUp();
  return NextResponse.json(
    { status: warmed ? "ok" : "warming" },
    { status: warmed ? 200 : 503 },
  );
}
