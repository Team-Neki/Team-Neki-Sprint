import { withMcpAuth, ok, fail } from "@/server/api/mcp-auth";
import { storeWikiFile } from "@/server/services/wiki-file";

export const dynamic = "force-dynamic";

/**
 * MCP 위키 첨부파일 업로드(multipart `file`). 세션 업로드와 같은 검증·저장 경로를 쓰고,
 * 본문에 fileAttachment 노드로 넣을 메타(id·name·size·mimeType)를 돌려준다.
 */
export const POST = withMcpAuth(async (actor, req) => {
  const form = await req.formData().catch(() => null);
  if (!form) return fail("multipart/form-data body with a 'file' field is required", 400);
  const result = await storeWikiFile(form.get("file"), actor.id);
  if (!result.ok) return fail(result.error, result.status);
  return ok(result.file, 201);
});
