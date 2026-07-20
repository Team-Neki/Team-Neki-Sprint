import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getWikiFile } from "@/lib/s3";

export const dynamic = "force-dynamic";

/**
 * 위키 첨부파일 서빙. 내부 툴이라 파일도 인증 게이트(로그인 유저만). 바이너리는 S3 에
 * 있고 DB 의 s3Key 로 조회해 스트림한다. 이미지와 달리 **항상 첨부로 다운로드**시킨다
 * (Content-Disposition: attachment) — 임의 파일이라 브라우저 인라인 렌더/실행을 막고,
 * nosniff 로 스니핑도 차단한다. 원본 파일명은 filename*=UTF-8'' 로 UTF-8 인코딩해 전달.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const file = await prisma.wikiFile.findUnique({
    where: { id },
    select: { s3Key: true, mimeType: true, name: true },
  });
  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  // S3 장애(권한·네트워크 등)는 업로드 라우트와 동일하게 502 로 응답한다.
  let object;
  try {
    object = await getWikiFile(file.s3Key);
  } catch {
    return new Response("파일 조회에 실패했습니다", { status: 502 });
  }
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": file.mimeType,
    // 항상 첨부(다운로드) — 인라인 렌더/실행 금지. filename* 은 RFC 5987 UTF-8 인코딩.
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
      file.name,
    )}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, max-age=31536000, immutable",
  };
  if (typeof object.contentLength === "number") {
    headers["Content-Length"] = String(object.contentLength);
  }

  return new Response(object.body, { headers });
}
