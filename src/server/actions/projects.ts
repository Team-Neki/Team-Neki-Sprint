"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { projectSchema } from "@/lib/validators";
import { logActivity } from "@/server/activity";
import { assertCanManage } from "@/lib/authz";
import { updateProjectFieldsCore } from "@/server/services/projects";

export async function createProject(input: unknown) {
  const user = await requireUser();
  const data = projectSchema.parse(input);

  // 담당자(ownerId)는 미지정 시 null 로 둔다 — 만든 사람으로 자동 지정하지 않는다.
  const project = await prisma.project.create({ data });

  await logActivity({
    userId: user.id,
    entityType: "project",
    entityId: project.id,
    action: "created",
    meta: { title: project.title },
  });

  revalidatePath("/projects");
  if (project.sprintId) revalidatePath(`/sprints/${project.sprintId}`);
  // 프로젝트 캐시 + 스프린트 캐시(하위 프로젝트 수 표시).
  return { id: project.id };
}

/** 다이얼로그 저장. 인라인 편집과 같은 코어로 필드별 히스토리·멘션 알림을 적용한다. */
export async function updateProject(id: string, input: unknown) {
  const user = await requireUser();
  return updateProjectFieldsCore(user, id, input);
}

/**
 * 프로젝트 상세 인라인 편집(B3) 단일 진입점: patch diff → 바뀐 필드만 update +
 * 필드별 before→after 를 Activity(`field_changed`)로 기록(B8).
 */
export async function updateProjectFields(id: string, input: unknown) {
  const user = await requireUser();
  return updateProjectFieldsCore(user, id, input);
}

export async function deleteProject(id: string) {
  const user = await requireUser();
  const existing = await prisma.project.findUnique({
    where: { id },
    select: { ownerId: true },
  });
  if (!existing) throw new Error("프로젝트를 찾을 수 없습니다");
  // 삭제는 소유자(owner) 또는 ADMIN 만.
  assertCanManage(user, "프로젝트", existing.ownerId);
  const project = await prisma.project.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    entityType: "project",
    entityId: id,
    action: "deleted",
  });
  revalidatePath("/projects");
  if (project.sprintId) revalidatePath(`/sprints/${project.sprintId}`);
}
