"use server";

import { revalidatePath } from "next/cache";
import type { Status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { taskSchema } from "@/lib/validators";
import { logActivity, diffFields } from "@/server/activity";
import { notifyNewMentions } from "@/server/notify";
import { isValueEmpty } from "@/lib/rich-content";
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
    // 보드에서 새 태스크는 해당 status 컬럼 하단에 append (B7-board).
    const status = data.status ?? "TODO";
    const agg = await tx.task.aggregate({
      where: { status },
      _max: { boardOrder: true },
    });
    const boardOrder = (agg._max.boardOrder ?? 0) + 1;
    return tx.task.create({
      data: { ...data, teamId, number, reporterId: user.id, boardOrder },
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

/**
 * 칸반 보드 드래그앤드롭(B7-board): 상태 변경 + 컬럼 내 순서 재정렬을 함께 처리.
 * `orderedIds` 는 드롭 대상 컬럼(status)의 새 순서 전체 — 해당 컬럼을 index 기준
 * 재번호(boardOrder=i)한다. 옮겨온 태스크만 status 를 갱신하고, 상태가 실제로
 * 바뀐 경우에만 Activity(status_changed)를 기록한다. 컬럼은 작아 전체 재번호가 저렴.
 */
export async function reorderBoardTask(
  id: string,
  status: Status,
  orderedIds: string[],
) {
  const user = await requireUser();

  const current = await prisma.task.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!current) return;

  await prisma.$transaction(
    orderedIds.map((tid, i) =>
      prisma.task.update({
        where: { id: tid },
        data: tid === id ? { status, boardOrder: i } : { boardOrder: i },
      }),
    ),
  );

  if (current.status !== status) {
    await logActivity({
      userId: user.id,
      entityType: "task",
      entityId: id,
      action: "status_changed",
      meta: { status },
    });
  }

  revalidatePath("/board");
  revalidatePath("/tasks");
}

function revalidateTaskPaths(id: string, epicId: string | null) {
  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  if (epicId) revalidatePath(`/epics/${epicId}`);
}

// 인라인 편집 시 로드하는 태스크의 편집 가능 필드(diff 대상). 팀/번호는 불변이라 제외.
const TASK_EDITABLE = {
  title: true,
  description: true,
  status: true,
  priority: true,
  assigneeId: true,
  reporterId: true,
  epicId: true,
  startDate: true,
  dueDate: true,
  storyPoints: true,
  estimatedMd: true,
  actualMd: true,
} as const;

/**
 * 상세 페이지 인라인 편집(B3)의 단일 진입점: 부분 patch 를 현재 값과 diff 해
 * 바뀐 필드만 update 하고, 필드별 before→after 를 Activity(`field_changed`)로 기록(B8).
 * 인라인 편집기는 단일 필드 patch(예: `{ status }`)로 호출한다.
 */
export async function updateTaskFields(id: string, input: unknown) {
  const user = await requireUser();
  const patch = taskSchema.partial().parse(input) as Record<string, unknown>;
  // 팀(teamId)과 번호는 생성 후 불변 — patch 에서 제외.
  delete patch.teamId;

  const current = await prisma.task.findUnique({
    where: { id },
    select: TASK_EDITABLE,
  });
  if (!current) throw new Error("태스크를 찾을 수 없습니다");

  const { changes, data } = diffFields(current, patch);
  if (changes.length === 0) return { id };

  const task = await prisma.task.update({ where: { id }, data });

  await Promise.all(
    changes.map((c) =>
      logActivity({
        userId: user.id,
        entityType: "task",
        entityId: id,
        action: "field_changed",
        meta: { field: c.field, from: c.from, to: c.to },
      }),
    ),
  );

  // 설명(description) 변경 시 새로 추가된 '@' 멘션 → 알림.
  const descChange = changes.find((c) => c.field === "description");
  if (descChange) {
    await notifyNewMentions({
      actorId: user.id,
      entityType: "task",
      entityId: id,
      context: task.title,
      before: current.description,
      after: task.description,
    });
  }

  revalidateTaskPaths(id, task.epicId);
  // 에픽 이동 시 이전 에픽 상세도 무효화.
  if (current.epicId && current.epicId !== task.epicId) {
    revalidatePath(`/epics/${current.epicId}`);
  }
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
  // body 는 Tiptap doc JSON 문자열(B6). 내용이 비면 무시.
  if (isValueEmpty(body)) return;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { title: true },
  });

  await prisma.comment.create({
    data: { taskId, body, authorId: user.id },
  });
  await logActivity({
    userId: user.id,
    entityType: "task",
    entityId: taskId,
    action: "commented",
  });
  // 댓글 본문의 '@' 멘션 → 수신자 알림(자기멘션 제외).
  await notifyNewMentions({
    actorId: user.id,
    entityType: "task",
    entityId: taskId,
    context: task?.title ?? null,
    after: body,
  });
  revalidatePath(`/tasks/${taskId}`);
}
