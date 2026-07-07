"use server";

import { revalidatePath } from "next/cache";
import type { Status, Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  taskSchema,
  statusEnum,
  priorityEnum,
  assigneeIdSchema,
} from "@/lib/validators";
import { logActivity } from "@/server/activity";
import { nextTeamNumber } from "@/server/keys";

export async function createTask(input: unknown) {
  const user = await requireUser();
  const data = taskSchema.parse(input);

  const task = await prisma.$transaction(async (tx) => {
    // Task는 생성 시점 Epic의 팀을 상속(teamId 고정). 에픽이 없으면 폼 선택 팀 사용.
    let teamId = data.teamId;
    if (data.epicId) {
      const epic = await tx.epic.findUnique({
        where: { id: data.epicId },
        select: { teamId: true },
      });
      if (epic) teamId = epic.teamId;
    }
    const number = await nextTeamNumber(tx, teamId);
    return tx.task.create({
      data: { ...data, teamId, number, reporterId: user.id },
    });
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
  // 팀(teamId)과 번호는 생성 후 불변 — 에픽 이동에도 key는 안정(재번호 없음).
  delete (data as { teamId?: string }).teamId;

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

function revalidateTaskPaths(id: string, epicId: string | null) {
  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  if (epicId) revalidatePath(`/epics/${epicId}`);
}

/** 상단 property bar 인라인 편집: 상태만 변경. */
export async function setTaskStatus(id: string, status: Status) {
  const user = await requireUser();
  const value = statusEnum.parse(status);
  const task = await prisma.task.update({
    where: { id },
    data: { status: value },
  });
  await logActivity({
    userId: user.id,
    entityType: "task",
    entityId: id,
    action: "status_changed",
    meta: { status: value },
  });
  revalidateTaskPaths(id, task.epicId);
  return { id };
}

/** 상단 property bar 인라인 편집: 우선순위만 변경. */
export async function setTaskPriority(id: string, priority: Priority) {
  const user = await requireUser();
  const value = priorityEnum.parse(priority);
  const task = await prisma.task.update({
    where: { id },
    data: { priority: value },
  });
  await logActivity({
    userId: user.id,
    entityType: "task",
    entityId: id,
    action: "updated",
    meta: { priority: value },
  });
  revalidateTaskPaths(id, task.epicId);
  return { id };
}

/** 상단 property bar 인라인 편집: 담당자만 변경. */
export async function setTaskAssignee(id: string, assigneeId: string | null) {
  const user = await requireUser();
  const value = assigneeIdSchema.parse(assigneeId);
  const task = await prisma.task.update({
    where: { id },
    data: { assigneeId: value },
  });
  await logActivity({
    userId: user.id,
    entityType: "task",
    entityId: id,
    action: "updated",
    meta: { assigneeId: value },
  });
  revalidateTaskPaths(id, task.epicId);
  return { id };
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
