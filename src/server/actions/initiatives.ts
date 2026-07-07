"use server";

import { revalidatePath } from "next/cache";
import type { Status, Priority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  initiativeSchema,
  statusEnum,
  priorityEnum,
  assigneeIdSchema,
} from "@/lib/validators";
import { logActivity } from "@/server/activity";

export async function createInitiative(input: unknown) {
  const user = await requireUser();
  const data = initiativeSchema.parse(input);

  const initiative = await prisma.initiative.create({
    data: { ...data, ownerId: data.ownerId ?? user.id },
  });

  await logActivity({
    userId: user.id,
    entityType: "initiative",
    entityId: initiative.id,
    action: "created",
    meta: { title: initiative.title },
  });

  revalidatePath("/initiatives");
  return { id: initiative.id };
}

export async function updateInitiative(id: string, input: unknown) {
  const user = await requireUser();
  const data = initiativeSchema.partial().parse(input);

  await prisma.initiative.update({ where: { id }, data });

  await logActivity({
    userId: user.id,
    entityType: "initiative",
    entityId: id,
    action: "updated",
  });

  revalidatePath("/initiatives");
  revalidatePath(`/initiatives/${id}`);
  return { id };
}

function revalidateInitiativePaths(id: string) {
  revalidatePath("/initiatives");
  revalidatePath(`/initiatives/${id}`);
}

/** 상단 property bar 인라인 편집: 상태만 변경. */
export async function setInitiativeStatus(id: string, status: Status) {
  const user = await requireUser();
  const value = statusEnum.parse(status);
  await prisma.initiative.update({ where: { id }, data: { status: value } });
  await logActivity({
    userId: user.id,
    entityType: "initiative",
    entityId: id,
    action: "status_changed",
    meta: { status: value },
  });
  revalidateInitiativePaths(id);
  return { id };
}

/** 상단 property bar 인라인 편집: 우선순위만 변경. */
export async function setInitiativePriority(id: string, priority: Priority) {
  const user = await requireUser();
  const value = priorityEnum.parse(priority);
  await prisma.initiative.update({ where: { id }, data: { priority: value } });
  await logActivity({
    userId: user.id,
    entityType: "initiative",
    entityId: id,
    action: "updated",
    meta: { priority: value },
  });
  revalidateInitiativePaths(id);
  return { id };
}

/** 상단 property bar 인라인 편집: 담당자(owner)만 변경. */
export async function setInitiativeOwner(id: string, ownerId: string | null) {
  const user = await requireUser();
  const value = assigneeIdSchema.parse(ownerId);
  await prisma.initiative.update({ where: { id }, data: { ownerId: value } });
  await logActivity({
    userId: user.id,
    entityType: "initiative",
    entityId: id,
    action: "updated",
    meta: { ownerId: value },
  });
  revalidateInitiativePaths(id);
  return { id };
}

export async function deleteInitiative(id: string) {
  const user = await requireUser();
  await prisma.initiative.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    entityType: "initiative",
    entityId: id,
    action: "deleted",
  });
  revalidatePath("/initiatives");
}
