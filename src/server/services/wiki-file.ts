import { prisma } from "@/lib/prisma";
import { newWikiFileKey, putWikiFile } from "@/lib/s3";

export const WIKI_FILE_MAX_BYTES = 25 * 1024 * 1024; // 25MB

// 첨부파일은 이미지와 달리 형식을 넓게 허용한다(pdf·docx·xlsx·zip 등). 다만 브라우저가
// 인라인으로 실행/렌더할 수 있어 same-origin XSS 위험이 있는 타입은 차단한다. 서빙은
// 항상 Content-Disposition: attachment + nosniff 라 인라인 실행을 막지만, 업로드
// 단계에서도 위험 타입을 걸러 이중 방어한다.
const BLOCKED = new Set([
  "image/svg+xml",
  "text/html",
  "application/xhtml+xml",
  "application/x-httpd-php",
]);

export type StoredWikiFile = {
  id: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
};

export type StoreWikiFileResult =
  | { ok: true; file: StoredWikiFile }
  | { ok: false; status: number; error: string };

/**
 * 위키 첨부파일 검증 + S3 저장 + DB 기록. 세션 업로드(/api/wiki/file)와
 * MCP 업로드(/api/mcp/v1/wiki/files)가 같은 규칙을 쓰도록 한곳에 둔다.
 */
export async function storeWikiFile(
  file: unknown,
  uploaderId: string,
): Promise<StoreWikiFileResult> {
  if (!(file instanceof File)) {
    return { ok: false, status: 400, error: "파일이 없습니다" };
  }
  if (BLOCKED.has(file.type)) {
    return { ok: false, status: 415, error: "첨부할 수 없는 파일 형식입니다" };
  }
  if (file.size > WIKI_FILE_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      error: "파일은 25MB 이하만 첨부할 수 있습니다",
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // 원본 파일명(다운로드 시 사용). name 은 NOT NULL 이라 빈 값이면 폴백.
  const name =
    (typeof file.name === "string" ? file.name.slice(0, 200) : "").trim() ||
    "첨부파일";
  // Content-Type 은 클라이언트가 준 값을 신뢰하되(빈 값이면 일반 바이너리), 서빙 시
  // nosniff + attachment 라 인라인 실행 위험은 없다.
  const mimeType = file.type || "application/octet-stream";

  // 먼저 S3 에 올린 뒤 DB 에 키를 기록한다. S3 실패 시 DB 행이 안 생기고,
  // DB 실패 시 S3 객체만 고아로 남지만(무해, GC 대상) 사용자에겐 실패로 응답한다.
  const s3Key = newWikiFileKey();
  try {
    await putWikiFile(s3Key, bytes, mimeType);
  } catch {
    return { ok: false, status: 502, error: "파일 저장에 실패했습니다" };
  }

  const wikiFile = await prisma.wikiFile.create({
    data: { s3Key, mimeType, name, size: file.size, uploaderId },
    select: { id: true },
  });

  return {
    ok: true,
    file: {
      id: wikiFile.id,
      url: `/api/wiki/file/${wikiFile.id}`,
      name,
      size: file.size,
      mimeType,
    },
  };
}
