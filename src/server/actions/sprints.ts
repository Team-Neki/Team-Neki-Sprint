"use server";

import { revalidatePath } from "next/cache";
import type { SprintStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { sprintSchema, sprintStatusEnum } from "@/lib/validators";
import { logActivity, diffFields } from "@/server/activity";
import { notifyNewMentions } from "@/server/notify";

export async function createSprint(input: unknown) {
  const user = await requireUser();
  const data = sprintSchema.parse(input);

  const sprint = await prisma.sprint.create({ data });

  await logActivity({
    userId: user.id,
    entityType: "sprint",
    entityId: sprint.id,
    action: "created",
    meta: { title: sprint.name },
  });

  revalidatePath("/sprints");
  return { id: sprint.id };
}

export async function updateSprint(id: string, input: unknown) {
  const user = await requireUser();
  const data = sprintSchema.partial().parse(input);

  await prisma.sprint.update({ where: { id }, data });

  await logActivity({
    userId: user.id,
    entityType: "sprint",
    entityId: id,
    action: "updated",
  });

  revalidatePath("/sprints");
  revalidatePath(`/sprints/${id}`);
  // 스프린트 이름·상태는 프로젝트 목록에도 표시되므로 프로젝트 캐시도 무효화.
  return { id };
}

// 스프린트 인라인 편집(diff 대상). 제목이 title 이 아니라 name, 기한이 dueDate 가
// 아니라 endDate 인 점만 다른 엔티티와 다르다(모델 차이).
const SPRINT_EDITABLE = {
  name: true,
  description: true,
  status: true,
  startDate: true,
  endDate: true,
} as const;

/**
 * 스프린트 상세 인라인 편집 단일 진입점: patch diff → 바뀐 필드만 update +
 * 필드별 before→after 를 Activity(`field_changed`)로 기록(B8).
 * updateSprint(다이얼로그 저장)는 action:"updated" 만 남겨 무엇이 바뀌었는지
 * 히스토리에서 알 수 없었다 — 인라인 편집은 이쪽을 쓴다.
 */
export async function updateSprintFields(id: string, input: unknown) {
  const user = await requireUser();
  const patch = sprintSchema.partial().parse(input) as Record<string, unknown>;

  const current = await prisma.sprint.findUnique({
    where: { id },
    select: SPRINT_EDITABLE,
  });
  if (!current) throw new Error("스프린트를 찾을 수 없습니다");

  const { changes, data } = diffFields(current, patch);
  if (changes.length === 0) return { id };

  const sprint = await prisma.sprint.update({ where: { id }, data });

  await Promise.all(
    changes.map((c) =>
      logActivity({
        userId: user.id,
        entityType: "sprint",
        entityId: id,
        action: "field_changed",
        meta: { field: c.field, from: c.from, to: c.to },
      }),
    ),
  );

  if (changes.some((c) => c.field === "description")) {
    await notifyNewMentions({
      actorId: user.id,
      entityType: "sprint",
      entityId: id,
      context: sprint.name,
      before: current.description,
      after: sprint.description,
    });
  }

  revalidatePath("/sprints");
  revalidatePath(`/sprints/${id}`);
  // 스프린트 이름·상태는 프로젝트 목록에도 표시된다.
  revalidatePath("/projects");
  return { id };
}

/** 스프린트 상태만 변경(목록/상세 인라인). */
export async function setSprintStatus(id: string, status: SprintStatus) {
  const user = await requireUser();
  const value = sprintStatusEnum.parse(status);
  await prisma.sprint.update({ where: { id }, data: { status: value } });
  await logActivity({
    userId: user.id,
    entityType: "sprint",
    entityId: id,
    action: "status_changed",
    meta: { status: value },
  });
  revalidatePath("/sprints");
  revalidatePath(`/sprints/${id}`);
  return { id };
}

export async function deleteSprint(id: string) {
  const user = await requireUser();
  // 하위 프로젝트는 sprintId가 SetNull 되어 남는다(프로젝트는 유지).
  await prisma.sprint.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    entityType: "sprint",
    entityId: id,
    action: "deleted",
  });
  revalidatePath("/sprints");
  revalidatePath("/projects");
}
