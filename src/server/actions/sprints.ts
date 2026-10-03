"use server";

import { revalidatePath } from "next/cache";
import type { SprintStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { sprintSchema, sprintStatusEnum } from "@/lib/validators";
import { logActivity } from "@/server/activity";
import { updateSprintFieldsCore } from "@/server/services/sprints";

export async function createSprint(input: unknown) {
  const user = await requireUser();
  const data = sprintSchema.parse(input);

  const sprint = await prisma.sprint.create({ data });

  await logActivity({
    userId: user.id,
    entityType: "sprint",
    entityId: sprint.id,
    action: "created",
    meta: { title: sprint.name },
  });

  revalidatePath("/sprints");
  return { id: sprint.id };
}

/** 다이얼로그 저장. 인라인 편집과 같은 코어로 필드별 히스토리·멘션 알림을 적용한다. */
export async function updateSprint(id: string, input: unknown) {
  const user = await requireUser();
  return updateSprintFieldsCore(user, id, input);
}

/**
 * 스프린트 상세 인라인 편집 단일 진입점: patch diff → 바뀐 필드만 update +
 * 필드별 before→after 를 Activity(`field_changed`)로 기록(B8).
 */
export async function updateSprintFields(id: string, input: unknown) {
  const user = await requireUser();
  return updateSprintFieldsCore(user, id, input);
}

/** 스프린트 상태만 변경(목록/상세 인라인). */
export async function setSprintStatus(id: string, status: SprintStatus) {
  const user = await requireUser();
  const value = sprintStatusEnum.parse(status);
  await prisma.sprint.update({ where: { id }, data: { status: value } });
  await logActivity({
    userId: user.id,
    entityType: "sprint",
    entityId: id,
    action: "status_changed",
    meta: { status: value },
  });
  revalidatePath("/sprints");
  revalidatePath(`/sprints/${id}`);
  return { id };
}

export async function deleteSprint(id: string) {
  const user = await requireUser();
  // 하위 프로젝트는 sprintId가 SetNull 되어 남는다(프로젝트는 유지).
  await prisma.sprint.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    entityType: "sprint",
    entityId: id,
    action: "deleted",
  });
  revalidatePath("/sprints");
  revalidatePath("/projects");
}
