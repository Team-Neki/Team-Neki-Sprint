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

export async function createEpic(input: unknown) {
  const user = await requireUser();
  const data = epicSchema.parse(input);

  const epic = await prisma.epic.create({
    data: { ...data, ownerId: data.ownerId ?? user.id },
  });

  await logActivity({
    userId: user.id,
    entityType: "epic",
    entityId: epic.id,
    action: "created",
    meta: { title: epic.title },
  });

  revalidatePath("/epics");
  if (epic.initiativeId) revalidatePath(`/initiatives/${epic.initiativeId}`);
  return { id: epic.id };
}

export async function updateEpic(id: string, input: unknown) {
  const user = await requireUser();
  const data = epicSchema.partial().parse(input);

  const epic = await prisma.epic.update({ where: { id }, data });

  await logActivity({
    userId: user.id,
    entityType: "epic",
    entityId: id,
    action: "updated",
  });

  revalidatePath("/epics");
  revalidatePath(`/epics/${id}`);
  if (epic.initiativeId) revalidatePath(`/initiatives/${epic.initiativeId}`);
  return { id };
}

function revalidateEpicPaths(id: string, initiativeId: string | null) {
  revalidatePath("/epics");
  revalidatePath(`/epics/${id}`);
  if (initiativeId) revalidatePath(`/initiatives/${initiativeId}`);
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
  revalidateEpicPaths(id, epic.initiativeId);
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
  revalidateEpicPaths(id, epic.initiativeId);
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
  revalidateEpicPaths(id, epic.initiativeId);
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
