import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getWikiImage } from "@/lib/s3";

export const dynamic = "force-dynamic";

/**
 * 위키 이미지 서빙. 내부 툴이라 이미지도 인증 게이트(로그인 유저만). 바이너리는 S3 에
 * 있고 DB 의 s3Key 로 조회해 스트림한다. URL 은 content-addressed(cuid) 라 캐시
 * immutable. Content-Type 은 DB 의 mimeType 을 신뢰(업로드 시 래스터만 허용),
 * nosniff 로 스니핑 차단.
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
  const image = await prisma.wikiImage.findUnique({
    where: { id },
    select: { s3Key: true, mimeType: true },
  });
  if (!image) {
    return new Response("Not found", { status: 404 });
  }

  // S3 장애(권한·네트워크 등)는 업로드 라우트와 동일하게 502 로 응답한다.
  let object;
  try {
    object = await getWikiImage(image.s3Key);
  } catch {
    return new Response("이미지 조회에 실패했습니다", { status: 502 });
  }
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": image.mimeType,
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  if (typeof object.contentLength === "number") {
    headers["Content-Length"] = String(object.contentLength);
  }

  return new Response(object.body, { headers });
}
