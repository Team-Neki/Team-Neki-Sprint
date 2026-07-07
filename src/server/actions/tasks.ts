"use server";

import { revalidatePath } from "next/cache";
import type { Status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { taskSchema } from "@/lib/validators";
import { logActivity } from "@/server/activity";

export async function createTask(input: unknown) {
  const user = await requireUser();
  const data = taskSchema.parse(input);

  const task = await prisma.task.create({
    data: { ...data, reporterId: user.id },
  });

  await logActivity({
    userId: user.id,
    entityType: "task",
    entityId: task.id,
    action: "created",
    meta: { title: task.title },
  });

  revalidatePath("/board");
  revalidatePath("/tasks");
  if (task.epicId) revalidatePath(`/epics/${task.epicId}`);
  return { id: task.id };
}

export async function updateTask(id: string, input: unknown) {
  const user = await requireUser();
  const data = taskSchema.partial().parse(input);

  const task = await prisma.task.update({ where: { id }, data });

  await logActivity({
    userId: user.id,
    entityType: "task",
    entityId: id,
    action: "updated",
  });

  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  if (task.epicId) revalidatePath(`/epics/${task.epicId}`);
  return { id };
}

/** Lightweight status change used by the Kanban board drag-and-drop. */
export async function moveTask(id: string, status: Status) {
  const user = await requireUser();
  await prisma.task.update({ where: { id }, data: { status } });
  await logActivity({
    userId: user.id,
    entityType: "task",
    entityId: id,
    action: "status_changed",
    meta: { status },
  });
  revalidatePath("/board");
  revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
  const user = await requireUser();
  await prisma.task.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    entityType: "task",
    entityId: id,
    action: "deleted",
  });
  revalidatePath("/board");
  revalidatePath("/tasks");
}

export async function addComment(taskId: string, body: string) {
  const user = await requireUser();
  const trimmed = body.trim();
  if (!trimmed) return;

  await prisma.comment.create({
    data: { taskId, body: trimmed, authorId: user.id },
  });
  await logActivity({
    userId: user.id,
    entityType: "task",
    entityId: taskId,
    action: "commented",
  });
  revalidatePath(`/tasks/${taskId}`);
}
