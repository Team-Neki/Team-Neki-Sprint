"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { teamSchema, assigneeIdSchema, roleSchema } from "@/lib/validators";
import { logActivity } from "@/server/activity";

export async function createTeam(input: unknown) {
  const user = await requireUser();
  const data = teamSchema.parse(input);

  const team = await prisma.team.create({
    data: { key: data.key, name: data.name, color: data.color ?? null },
  });

  await logActivity({
    userId: user.id,
    entityType: "team",
    entityId: team.id,
    action: "created",
    meta: { title: `${team.key} · ${team.name}` },
  });

  revalidatePath("/teams");
  return { id: team.id };
}

export async function updateTeam(id: string, input: unknown) {
  const user = await requireUser();
  // key는 이슈 key 접두어라 생성 후 변경 불가(표시 key 안정성). name/color만 수정.
  const data = teamSchema.partial().parse(input);

  await prisma.team.update({
    where: { id },
    data: { name: data.name, color: data.color ?? null },
  });

  await logActivity({
    userId: user.id,
    entityType: "team",
    entityId: id,
    action: "updated",
  });

  revalidatePath("/teams");  return { id };
}

export async function deleteTeam(id: string) {
  const user = await requireUser();
  // 소속 유저는 teamId가 SetNull. 에픽/태스크가 있으면 FK 제약으로 삭제 실패한다.
  const counts = await prisma.team.findUnique({
    where: { id },
    select: { _count: { select: { epics: true, tasks: true } } },
  });
  if (counts && (counts._count.epics > 0 || counts._count.tasks > 0)) {
    throw new Error("이슈가 연결된 팀은 삭제할 수 없습니다");
  }
  await prisma.team.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    entityType: "team",
    entityId: id,
    action: "deleted",
  });
  revalidatePath("/teams");}

/** 유저-팀 배정(수동). 한 사람 = 한 팀. null이면 무소속. */
export async function setUserTeam(userId: string, teamId: string | null) {
  const user = await requireUser();
  // 멤버 배정은 관리자(ADMIN) 전용. UI 노출뿐 아니라 서버에서도 차단(방어).
  if (user.role !== "ADMIN") {
    throw new Error("관리자만 멤버 팀 배정을 변경할 수 있습니다.");
  }
  const value = assigneeIdSchema.parse(teamId);
  await prisma.user.update({ where: { id: userId }, data: { teamId: value } });
  await logActivity({
    userId: user.id,
    entityType: "team",
    entityId: value ?? userId,
    action: "updated",
    meta: { userId, teamId: value },
  });
  revalidatePath("/teams");  return { id: userId };
}

/** 유저 역할(ADMIN/MEMBER) 변경. 관리자 전용. 본인 역할은 바꿀 수 없다(마지막 관리자 잠금 방지). */
export async function setUserRole(userId: string, role: unknown) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("관리자만 역할을 변경할 수 있습니다.");
  }
  if (userId === user.id) {
    throw new Error("본인의 역할은 변경할 수 없습니다.");
  }
  const value = roleSchema.parse(role);
  // 관리자 둘이 동시에 서로를 강등하면 둘 다 세션 검사를 통과해 관리자가 0명이 될 수 있다.
  // 직렬화 트랜잭션 안에서 요청자 역할을 다시 읽어, 경합 시 한쪽은 직렬화 실패로 거부된다.
  await prisma.$transaction(
    async (tx) => {
      const actor = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { role: true },
      });
      if (actor.role !== "ADMIN") {
        throw new Error("관리자만 역할을 변경할 수 있습니다.");
      }
      await tx.user.update({ where: { id: userId }, data: { role: value } });
    },
    { isolationLevel: "Serializable" },
  );
  await logActivity({
    userId: user.id,
    entityType: "team",
    entityId: userId,
    action: "updated",
    meta: { userId, role: value },
  });
  revalidatePath("/teams");
  return { id: userId };
}
