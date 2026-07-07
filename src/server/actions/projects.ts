"use server";

import { revalidatePath } from "next/cache";
import type { Status, Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  projectSchema,
  statusEnum,
  priorityEnum,
  assigneeIdSchema,
} from "@/lib/validators";
import { logActivity } from "@/server/activity";

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

/** 상단 property bar 인라인 편집: 상태만 변경. */
export async function setProjectStatus(id: string, status: Status) {
  const user = await requireUser();
  const value = statusEnum.parse(status);
  const project = await prisma.project.update({
    where: { id },
    data: { status: value },
  });
  await logActivity({
    userId: user.id,
    entityType: "project",
    entityId: id,
    action: "status_changed",
    meta: { status: value },
  });
  revalidateProjectPaths(id, project.sprintId);
  return { id };
}

/** 상단 property bar 인라인 편집: 우선순위만 변경. */
export async function setProjectPriority(id: string, priority: Priority) {
  const user = await requireUser();
  const value = priorityEnum.parse(priority);
  const project = await prisma.project.update({
    where: { id },
    data: { priority: value },
  });
  await logActivity({
    userId: user.id,
    entityType: "project",
    entityId: id,
    action: "updated",
    meta: { priority: value },
  });
  revalidateProjectPaths(id, project.sprintId);
  return { id };
}

/** 상단 property bar 인라인 편집: 담당자(owner)만 변경. */
export async function setProjectOwner(id: string, ownerId: string | null) {
  const user = await requireUser();
  const value = assigneeIdSchema.parse(ownerId);
  const project = await prisma.project.update({
    where: { id },
    data: { ownerId: value },
  });
  await logActivity({
    userId: user.id,
    entityType: "project",
    entityId: id,
    action: "updated",
    meta: { ownerId: value },
  });
  revalidateProjectPaths(id, project.sprintId);
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
