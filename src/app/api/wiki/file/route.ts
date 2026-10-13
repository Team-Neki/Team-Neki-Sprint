import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { storeWikiFile } from "@/server/services/wiki-file";

export const dynamic = "force-dynamic";

/** 위키 본문 파일 첨부 업로드. 인증 필수, 위험 타입 차단·크기 검증 후 DB 저장하고 메타 반환. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const form = await request.formData();
  const result = await storeWikiFile(form.get("file"), session.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.file);
}
