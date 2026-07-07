"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { epicSchema } from "@/lib/validators";
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
