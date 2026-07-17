"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { epicSchema } from "@/lib/validators";
import { logActivity, diffFields } from "@/server/activity";
import { notifyNewMentions } from "@/server/notify";
import { nextTeamNumber } from "@/server/keys";
import { assertCanManage } from "@/lib/authz";

export async function createEpic(input: unknown) {
  const user = await requireUser();
  const data = epicSchema.parse(input);

  // 팀 시퀀스를 원자적으로 증가시켜 number를 부여한다(epic·task 공유).
  const epic = await prisma.$transaction(async (tx) => {
    const number = await nextTeamNumber(tx, data.teamId);
    // 담당자(ownerId)는 미지정 시 null 로 둔다 — 만든 사람으로 자동 지정하지 않는다.
    return tx.epic.create({
      data: { ...data, number },
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
  // 에픽 캐시 + 프로젝트 캐시(하위 에픽 수 표시). 태스크는 새 에픽엔 아직 없음.
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
  // 에픽 제목은 태스크 목록에도 표시되므로 태스크 캐시도 함께 무효화.
  return { id };
}

function revalidateEpicPaths(id: string, projectId: string | null) {
  revalidatePath("/epics");
  revalidatePath(`/epics/${id}`);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

// 에픽 인라인 편집(diff 대상). 팀/번호는 불변이라 제외.
const EPIC_EDITABLE = {
  title: true,
  description: true,
  status: true,
  priority: true,
  ownerId: true,
  projectId: true,
  startDate: true,
  dueDate: true,
} as const;

/**
 * 에픽 상세 인라인 편집(B3) 단일 진입점: patch diff → 바뀐 필드만 update +
 * 필드별 before→after 를 Activity(`field_changed`)로 기록(B8).
 */
export async function updateEpicFields(id: string, input: unknown) {
  const user = await requireUser();
  const patch = epicSchema.partial().parse(input) as Record<string, unknown>;
  // 팀(teamId)은 생성 후 불변 — 표시 key 안정성 위해 patch 에서 제외.
  delete patch.teamId;

  const current = await prisma.epic.findUnique({
    where: { id },
    select: EPIC_EDITABLE,
  });
  if (!current) throw new Error("에픽을 찾을 수 없습니다");

  const { changes, data } = diffFields(current, patch);
  if (changes.length === 0) return { id };

  const epic = await prisma.epic.update({ where: { id }, data });

  await Promise.all(
    changes.map((c) =>
      logActivity({
        userId: user.id,
        entityType: "epic",
        entityId: id,
        action: "field_changed",
        meta: { field: c.field, from: c.from, to: c.to },
      }),
    ),
  );

  if (changes.some((c) => c.field === "description")) {
    await notifyNewMentions({
      actorId: user.id,
      entityType: "epic",
      entityId: id,
      context: epic.title,
      before: current.description,
      after: epic.description,
    });
  }

  revalidateEpicPaths(id, epic.projectId);
  // 프로젝트 이동 시 이전 프로젝트 상세도 무효화.
  if (current.projectId && current.projectId !== epic.projectId) {
    revalidatePath(`/projects/${current.projectId}`);
  }
  return { id };
}

export async function deleteEpic(id: string) {
  const user = await requireUser();
  const epic = await prisma.epic.findUnique({
    where: { id },
    select: { ownerId: true },
  });
  if (!epic) throw new Error("에픽을 찾을 수 없습니다");
  // 삭제는 소유자(owner) 또는 ADMIN 만.
  assertCanManage(user, "에픽", epic.ownerId);
  await prisma.epic.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    entityType: "epic",
    entityId: id,
    action: "deleted",
  });
  revalidatePath("/epics");
}
