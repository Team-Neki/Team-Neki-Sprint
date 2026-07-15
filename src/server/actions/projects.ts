"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { projectSchema } from "@/lib/validators";
import { logActivity, diffFields } from "@/server/activity";
import { notifyNewMentions } from "@/server/notify";
import { assertCanManage } from "@/lib/authz";

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

export async function updateProject(id: string, input: unknown) {
  const user = await requireUser();
  const data = projectSchema.partial().parse(input);

  const project = await prisma.project.update({ where: { id }, data });

  await logActivity({
    userId: user.id,
    entityType: "project",
    entityId: id,
    action: "updated",
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  if (project.sprintId) revalidatePath(`/sprints/${project.sprintId}`);
  // 프로젝트 제목은 에픽 목록에도 표시되므로 에픽 캐시도 함께 무효화.
  return { id };
}

function revalidateProjectPaths(id: string, sprintId: string | null) {
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  if (sprintId) revalidatePath(`/sprints/${sprintId}`);
}

// 프로젝트 인라인 편집(diff 대상).
const PROJECT_EDITABLE = {
  title: true,
  description: true,
  status: true,
  priority: true,
  ownerId: true,
  sprintId: true,
  startDate: true,
  dueDate: true,
} as const;

/**
 * 프로젝트 상세 인라인 편집(B3) 단일 진입점: patch diff → 바뀐 필드만 update +
 * 필드별 before→after 를 Activity(`field_changed`)로 기록(B8).
 */
export async function updateProjectFields(id: string, input: unknown) {
  const user = await requireUser();
  const patch = projectSchema.partial().parse(input) as Record<string, unknown>;

  const current = await prisma.project.findUnique({
    where: { id },
    select: PROJECT_EDITABLE,
  });
  if (!current) throw new Error("프로젝트를 찾을 수 없습니다");

  const { changes, data } = diffFields(current, patch);
  if (changes.length === 0) return { id };

  const project = await prisma.project.update({ where: { id }, data });

  await Promise.all(
    changes.map((c) =>
      logActivity({
        userId: user.id,
        entityType: "project",
        entityId: id,
        action: "field_changed",
        meta: { field: c.field, from: c.from, to: c.to },
      }),
    ),
  );

  if (changes.some((c) => c.field === "description")) {
    await notifyNewMentions({
      actorId: user.id,
      entityType: "project",
      entityId: id,
      context: project.title,
      before: current.description,
      after: project.description,
    });
  }

  revalidateProjectPaths(id, project.sprintId);
  // 스프린트 이동 시 이전 스프린트도 무효화.
  if (current.sprintId && current.sprintId !== project.sprintId) {
    revalidatePath(`/sprints/${current.sprintId}`);
  }
  return { id };
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
