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
 * `orderedIds` 는 드롭 대상 컬럼(status)에서 "보이는(visible)" 태스크의 새 순서다.
 *
 * 주의(A2): 보드 필터(담당자/팀)가 걸린 뷰에서는 orderedIds 가 필터를 통과한
 * visible 태스크만 담는다. 그래서 예전처럼 orderedIds 만 0..n 으로 재번호하면
 * 같은 컬럼의 숨은(필터 제외) 태스크 boardOrder 와 충돌·순서 붕괴가 난다.
 * 해결: 대상 컬럼의 "전체" 태스크를 로드해 visible 새 순서와 병합한 뒤 전체를
 * 한 번에 재번호한다. 숨은 태스크는 이동 전 인접했던 visible 태스크 바로 뒤에
 * 다시 앵커링되어 상대 위치가 보존되고, 전체를 일관되게 재번호하므로 충돌이 없다.
 * 옮겨온 태스크만 status 를 갱신하고, 상태가 실제로 바뀐 경우에만
 * Activity(status_changed)를 기록한다. 컬럼은 작아 전체 재번호가 저렴.
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

  await prisma.$transaction(async (tx) => {
    // 대상 컬럼(status) 전체를 현재 순서(boardOrder asc nulls last, createdAt asc)로
    // 로드. 크로스 컬럼 이동이면 이동 태스크(id)는 아직 다른 status 라 여기 없음.
    const columnTasks = await tx.task.findMany({
      where: { status },
      select: { id: true },
      orderBy: [
        { boardOrder: { sort: "asc", nulls: "last" } },
        { createdAt: "asc" },
      ],
    });

    // 숨은 태스크를 "직전 visible 태스크"에 앵커링해 상대 위치를 보존한다.
    // 어떤 visible 보다도 앞에 있던 숨은 태스크는 START 앵커로 묶어 선두에 둔다.
    const visible = new Set(orderedIds);
    const START = "__start__";
    const hiddenAfter = new Map<string, string[]>();
    let anchor = START;
    for (const t of columnTasks) {
      if (visible.has(t.id)) {
        anchor = t.id; // visible 은 orderedIds 순서로 배치되므로 앵커로만 쓴다.
      } else {
        const arr = hiddenAfter.get(anchor);
        if (arr) arr.push(t.id);
        else hiddenAfter.set(anchor, [t.id]);
      }
    }

    // 최종 전체 순서 = (선두 숨은 태스크) → orderedIds 각 visible + 그 뒤 앵커된 숨은 태스크.
    const merged: string[] = [...(hiddenAfter.get(START) ?? [])];
    for (const vid of orderedIds) {
      merged.push(vid);
      const after = hiddenAfter.get(vid);
      if (after) merged.push(...after);
    }
    // 방어: 크로스 컬럼 이동 태스크가 어떤 이유로 merged 에 빠졌다면 말미에 추가.
    if (!merged.includes(id)) merged.push(id);

    // 전체 컬럼을 0..n 정수로 재번호(충돌 없음). 이동 태스크만 status 도 갱신.
    for (let i = 0; i < merged.length; i++) {
      const tid = merged[i];
      await tx.task.update({
        where: { id: tid },
        data: tid === id ? { status, boardOrder: i } : { boardOrder: i },
      });
    }
  });

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
