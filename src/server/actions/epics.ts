"use server";

import { revalidatePath } from "next/cache";
import type { Status, Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  epicSchema,
  statusEnum,
  priorityEnum,
  assigneeIdSchema,
} from "@/lib/validators";
import { logActivity } from "@/server/activity";
import { nextTeamNumber } from "@/server/keys";

export async function createEpic(input: unknown) {
  const user = await requireUser();
  const data = epicSchema.parse(input);

  // 팀 시퀀스를 원자적으로 증가시켜 number를 부여한다(epic·task 공유).
  const epic = await prisma.$transaction(async (tx) => {
    const number = await nextTeamNumber(tx, data.teamId);
    return tx.epic.create({
      data: { ...data, number, ownerId: data.ownerId ?? user.id },
    });
  });

  await logActivity({
    userId: user.id,
    entityType: "epic",
    entityId: epic.id,
    action: "created",
    meta: { title: epic.title },
  });

  revalidatePath("/epics");
  if (epic.projectId) revalidatePath(`/projects/${epic.projectId}`);
  return { id: epic.id };
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
  return { id };
}

function revalidateEpicPaths(id: string, projectId: string | null) {
  revalidatePath("/epics");
  revalidatePath(`/epics/${id}`);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

/** 상단 property bar 인라인 편집: 상태만 변경. */
export async function setEpicStatus(id: string, status: Status) {
  const user = await requireUser();
  const value = statusEnum.parse(status);
  const epic = await prisma.epic.update({
    where: { id },
    data: { status: value },
  });
  await logActivity({
    userId: user.id,
    entityType: "epic",
    entityId: id,
    action: "status_changed",
    meta: { status: value },
  });
  revalidateEpicPaths(id, epic.projectId);
  return { id };
}

/** 상단 property bar 인라인 편집: 우선순위만 변경. */
export async function setEpicPriority(id: string, priority: Priority) {
  const user = await requireUser();
  const value = priorityEnum.parse(priority);
  const epic = await prisma.epic.update({
    where: { id },
    data: { priority: value },
  });
  await logActivity({
    userId: user.id,
    entityType: "epic",
    entityId: id,
    action: "updated",
    meta: { priority: value },
  });
  revalidateEpicPaths(id, epic.projectId);
  return { id };
}

/** 상단 property bar 인라인 편집: 담당자(owner)만 변경. */
export async function setEpicOwner(id: string, ownerId: string | null) {
  const user = await requireUser();
  const value = assigneeIdSchema.parse(ownerId);
  const epic = await prisma.epic.update({
    where: { id },
    data: { ownerId: value },
  });
  await logActivity({
    userId: user.id,
    entityType: "epic",
    entityId: id,
    action: "updated",
    meta: { ownerId: value },
  });
  revalidateEpicPaths(id, epic.projectId);
  return { id };
}

export async function deleteEpic(id: string) {
  const user = await requireUser();
  await prisma.epic.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    entityType: "epic",
    entityId: id,
    action: "deleted",
  });
  revalidatePath("/epics");
}
