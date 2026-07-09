import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * 위키 이미지 서빙. 내부 툴이라 이미지도 인증 게이트(로그인 유저만). content-addressed
 * (cuid) 라 캐시 immutable. nosniff 로 content-type 스니핑 차단(업로드 시 래스터만 허용).
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
    select: { data: true, mimeType: true },
  });
  if (!image) {
    return new Response("Not found", { status: 404 });
  }

  const body = Buffer.from(image.data);
  return new Response(body, {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
