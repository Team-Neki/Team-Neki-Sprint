import { prisma } from "@/lib/prisma";
import { parseDoc } from "@/lib/rich-content";
import { extractMentionUserIds, extractMentionTeamIds } from "@/lib/mentions";

/**
 * 저장 전/후 doc 을 비교해 '새로 추가된' 멘션의 수신자 userId 목록을 만든다.
 * - personMention: 해당 사용자
 * - teamMention: 그 팀 소속 사용자 전원으로 확장
 * 팀을 먼저 사용자로 **확장한 뒤** 최종 수신자 집합끼리 차집합을 취한다 — 팀 id
 * 차집합만 보면 "직접 멘션 → 그 사람이 속한 팀 멘션으로 교체" 같은 경우 이미
 * 알림받은 사용자에게 중복 알림이 간다(팀 구성은 현재 시점 기준). 자기 자신은 제외.
 */
export async function newMentionRecipients(
  beforeDoc: unknown,
  afterDoc: unknown,
  actorId: string,
): Promise<string[]> {
  const prevUsers = extractMentionUserIds(beforeDoc);
  const nextUsers = extractMentionUserIds(afterDoc);
  const prevTeams = extractMentionTeamIds(beforeDoc);
  const nextTeams = extractMentionTeamIds(afterDoc);

  const allTeamIds = [...new Set([...prevTeams, ...nextTeams])];
  const membersByTeam = new Map<string, string[]>();
  if (allTeamIds.length > 0) {
    const rows = await prisma.user.findMany({
      where: { teamId: { in: allTeamIds } },
      select: { id: true, teamId: true },
    });
    for (const row of rows) {
      if (!row.teamId) continue;
      const list = membersByTeam.get(row.teamId);
      if (list) list.push(row.id);
      else membersByTeam.set(row.teamId, [row.id]);
    }
  }

  const expand = (users: Set<string>, teams: Set<string>): Set<string> => {
    const s = new Set(users);
    for (const teamId of teams) {
      for (const uid of membersByTeam.get(teamId) ?? []) s.add(uid);
    }
    return s;
  };
  const prevRecipients = expand(prevUsers, prevTeams);
  const nextRecipients = expand(nextUsers, nextTeams);

  return [...nextRecipients].filter(
    (uid) => !prevRecipients.has(uid) && uid !== actorId,
  );
}

/**
 * 리치 텍스트(설명/댓글)의 '새로 추가된' 멘션(사람 + 팀)에 대해 수신자별 알림 생성(B6).
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
  // 문자열 저장값(JSON 또는 레거시 plain) → doc. before 없음(parseDoc(null)=빈 doc)
  // 이면 after 의 모든 멘션이 신규.
  const recipients = await newMentionRecipients(
    parseDoc(before),
    parseDoc(after),
    actorId,
  );
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((uid) => ({
      userId: uid,
      actorId,
      type: "mention",
      entityType,
      entityId,
      context,
    })),
  });
}
