import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { newWikiImageKey, putWikiImage } from "@/lib/s3";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
// 래스터 이미지만 허용. SVG 는 스크립트를 담을 수 있어(직접 URL 열람 시 same-origin
// XSS) 제외한다. 매직바이트까지 검사하진 않되, 서빙 시 X-Content-Type-Options:nosniff.
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/** 위키 본문 이미지 업로드. 인증 필수, 형식·크기 검증 후 DB 저장하고 서빙 URL 반환. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "지원하지 않는 이미지 형식입니다 (PNG·JPEG·GIF·WebP)" },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "이미지는 5MB 이하만 첨부할 수 있습니다" },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // 먼저 S3 에 올린 뒤 DB 에 키를 기록한다. S3 실패 시 DB 행이 안 생기고,
  // DB 실패 시 S3 객체만 고아로 남지만(무해, GC 대상) 사용자에겐 실패로 응답한다.
  const s3Key = newWikiImageKey();
  try {
    await putWikiImage(s3Key, bytes, file.type);
  } catch {
    return NextResponse.json(
      { error: "이미지 저장에 실패했습니다" },
      { status: 502 },
    );
  }

  const image = await prisma.wikiImage.create({
    data: {
      s3Key,
      mimeType: file.type,
      name: typeof file.name === "string" ? file.name.slice(0, 200) : null,
      size: file.size,
      uploaderId: session.user.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ url: `/api/wiki/image/${image.id}` });
}
