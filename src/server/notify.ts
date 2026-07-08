import { prisma } from "@/lib/prisma";
import { mentionsInValue } from "@/lib/rich-content";

/**
 * 리치 텍스트(설명/댓글)의 '새로 추가된' 사람 멘션에 대해 수신자별 알림 생성(B6).
 * before(수정 전)와 after(수정 후)의 멘션 차집합만 → 재저장/수정 시 중복 알림 방지.
 * 자기 자신 멘션은 제외. 새 댓글처럼 before 가 없으면 after 의 모든 멘션이 대상.
 */
export async function notifyNewMentions({
  actorId,
  entityType,
  entityId,
  context,
  before,
  after,
}: {
  actorId: string;
  entityType: string;
  entityId: string;
  context: string | null;
  before?: string | null;
  after: string | null;
}) {
  const prev = before != null ? mentionsInValue(before) : new Set<string>();
  const next = mentionsInValue(after);
  const added = [...next].filter((uid) => !prev.has(uid) && uid !== actorId);
  if (added.length === 0) return;

  await prisma.notification.createMany({
    data: added.map((uid) => ({
      userId: uid,
      actorId,
      type: "mention",
      entityType,
      entityId,
      context,
    })),
  });
}
