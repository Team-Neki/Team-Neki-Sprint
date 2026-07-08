"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { projectSchema } from "@/lib/validators";
import { logActivity, diffFields } from "@/server/activity";
import { notifyNewMentions } from "@/server/notify";

export async function createProject(input: unknown) {
  const user = await requireUser();
  const data = projectSchema.parse(input);

  const project = await prisma.project.create({
    data: { ...data, ownerId: data.ownerId ?? user.id },
  });

  await logActivity({
    userId: user.id,
    entityType: "project",
    entityId: project.id,
    action: "created",
    meta: { title: project.title },
  });

  revalidatePath("/projects");
  if (project.sprintId) revalidatePath(`/sprints/${project.sprintId}`);
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
