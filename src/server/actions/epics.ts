"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { epicSchema } from "@/lib/validators";
import { logActivity } from "@/server/activity";
import {
  createEpicCore,
  updateEpicFieldsCore,
  deleteEpicCore,
} from "@/server/services/epics";

export async function createEpic(input: unknown) {
  const user = await requireUser();
  return createEpicCore(user, input);
}

export async function updateEpic(id: string, input: unknown) {
  const user = await requireUser();
  const data = epicSchema.partial().parse(input);
  // 팀(teamId)은 생성 후 불변 — 표시 key 안정성 위해 수정에서 제외.
  delete (data as { teamId?: string }).teamId;

  const epic = await prisma.epic.update({ where: { id }, data });

  await logActivity({
    userId: user.id,
    entityType: "epic",
    entityId: id,
    action: "updated",
  });

  revalidatePath("/epics");
  revalidatePath(`/epics/${id}`);
  if (epic.projectId) revalidatePath(`/projects/${epic.projectId}`);
  // 에픽 제목은 태스크 목록에도 표시되므로 태스크 캐시도 함께 무효화.
  return { id };
}

/**
 * 에픽 상세 인라인 편집(B3) 단일 진입점: patch diff → 바뀐 필드만 update +
 * 필드별 before→after 를 Activity(`field_changed`)로 기록(B8).
 */
export async function updateEpicFields(id: string, input: unknown) {
  const user = await requireUser();
  return updateEpicFieldsCore(user, id, input);
}

export async function deleteEpic(id: string) {
  const user = await requireUser();
  return deleteEpicCore(user, id);
}
