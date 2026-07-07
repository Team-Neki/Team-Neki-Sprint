import type { Prisma } from "@prisma/client";

/**
 * 팀 단위 이슈 번호 부여. Epic·Task가 하나의 연속 시퀀스를 공유한다(재시작 없음).
 *
 * 반드시 `prisma.$transaction` 안에서 트랜잭션 클라이언트로 호출한다. Team.seq를
 * 원자적으로 +1 하고 새 값을 돌려주므로, 동시 생성에도 번호가 겹치지 않는다.
 * `@@unique([teamId, number])` 가 최종 방어선.
 */
export async function nextTeamNumber(
  tx: Prisma.TransactionClient,
  teamId: string,
): Promise<number> {
  const team = await tx.team.update({
    where: { id: teamId },
    data: { seq: { increment: 1 } },
    select: { seq: true },
  });
  return team.seq;
}
