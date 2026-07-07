import { prisma } from "@/lib/prisma";

type EntityType = "sprint" | "project" | "team" | "epic" | "task" | "wiki";

/** Fire-and-forget activity log. Never throws into the caller's flow. */
export async function logActivity(params: {
  userId?: string | null;
  entityType: EntityType;
  entityId: string;
  action: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.activity.create({
      data: {
        userId: params.userId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        meta: params.meta ? (params.meta as object) : undefined,
      },
    });
  } catch {
    // logging must not break the mutation
  }
}
