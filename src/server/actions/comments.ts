"use server";

import { requireUser } from "@/lib/session";
import {
  addEntityCommentCore,
  type CommentEntityType as EntityType,
} from "@/server/services/comments";

// 컴포넌트는 이 경로에서 타입을 가져간다. "use server" 파일이라 re-export 대신 기존과 같은 별칭 선언으로 둔다.
export type CommentEntityType = EntityType;

/**
 * 댓글 추가. body 는 Tiptap doc JSON 문자열(B6). 빈 문서면 무시.
 * 본문의 '@' 멘션(사람/팀)은 수신자 알림으로(자기멘션 제외) — 태스크 댓글과 동일.
 * '#' 티켓/위키 멘션은 링크일 뿐 알림 대상 아님(기존 정책 유지).
 */
export async function addEntityComment(
  entityType: CommentEntityType,
  entityId: string,
  body: string,
) {
  const user = await requireUser();
  return addEntityCommentCore(user, entityType, entityId, body);
}
