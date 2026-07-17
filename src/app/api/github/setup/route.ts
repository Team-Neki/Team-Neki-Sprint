import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * GitHub App 설치 후 리다이렉트되는 콜백.
 * ?installation_id=..&setup_action=install|update 로 도착. 설치를 저장하고 앱으로 복귀.
 * accountLogin 은 installation webhook 에서 보강되므로 여기선 빈 값 허용.
 *
 * 인증된 사용자만 설치를 등록할 수 있게 막는다(익명이 임의 installation_id 를 심어 이후 API
 * 대상을 바꾸는 것 방지). 설치 시작 시 발급한 일회성 state 대조까지 넣는 완전 방어는 후속 과제.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }
  const installationId = Number(url.searchParams.get("installation_id"));
  const action = url.searchParams.get("setup_action");
  if (!installationId || Number.isNaN(installationId)) {
    return NextResponse.json({ error: "installation_id 누락" }, { status: 400 });
  }
  if (action === "install" || action === "update") {
    await prisma.githubInstallation.upsert({
      where: { installationId },
      create: { installationId, accountLogin: "" },
      update: {},
    });
  }
  return NextResponse.redirect(new URL("/?github=connected", url.origin));
}
