"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { initiativeSchema } from "@/lib/validators";
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
