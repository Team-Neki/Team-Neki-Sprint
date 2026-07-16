import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GitHub App 설치 후 리다이렉트되는 콜백.
 * ?installation_id=..&setup_action=install|update 로 도착. 설치를 저장하고 앱으로 복귀.
 * accountLogin 은 installation webhook 에서 보강되므로 여기선 빈 값 허용.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
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
