// 태스크 쓰기 코어(actor 주입). 서버 액션과 MCP API 라우트가 공유한다.
// use server 지시어가 없어 서버 액션으로 노출되지 않는다 — 클라이언트가 actor 를 위조해 호출할 수 없다.
// ponytail: import 가드는 prisma 가 클라이언트 번들 빌드를 깨는 것으로 대신한다. 명시적 가드가 필요하면 server-only 를 설치해 import.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { taskSchema } from "@/lib/validators";
import { logActivity, diffFields } from "@/server/activity";
import { notifyNewMentions } from "@/server/notify";
import { nextTeamNumber } from "@/server/keys";
import { assertCanManage, type Actor } from "@/lib/authz";
import { parsePatch } from "@/server/services/patch";

/** createTask의 actor 주입 코어. 서버 액션과 MCP API 라우트가 공유한다. */
export async function createTaskCore(actor: Actor, input: unknown) {
  const data = taskSchema.parse(input);
  // 담당자 상호배타(B4): 둘 다 지정되면 유저 담당자를 우선(팀 담당자 제거).
  if (data.assigneeId && data.assigneeTeamId) {
    data.assigneeTeamId = null;
  }

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
      data: { ...data, teamId, number, reporterId: actor.id, boardOrder },
    });
  });

  await logActivity({
    userId: actor.id,
    entityType: "task",
    entityId: task.id,
    action: "created",
    meta: { title: task.title },
  });

  revalidatePath("/board");
  revalidatePath("/tasks");
  if (task.epicId) revalidatePath(`/epics/${task.epicId}`);
  // 태스크 캐시 + 에픽 캐시(하위 태스크 수·SP 롤업이 목록에 표시됨).
  return { id: task.id };
}

function revalidateTaskPaths(id: string, epicId: string | null) {
  revalidatePath("/board");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  if (epicId) revalidatePath(`/epics/${epicId}`);
  // 에픽 MD 롤업(getEpics)·스프린트 MD 합(getSprints)이 태스크 estimatedMd 에 의존.
}

// 인라인 편집 시 로드하는 태스크의 편집 가능 필드(diff 대상). 팀/번호는 불변이라 제외.
const TASK_EDITABLE = {
  title: true,
  description: true,
  status: true,
  priority: true,
  assigneeId: true,
  assigneeTeamId: true,
  reporterId: true,
  epicId: true,
  startDate: true,
  dueDate: true,
  estimatedMd: true,
  actualMd: true,
} as const;

/** updateTaskFields의 actor 주입 코어. 서버 액션과 MCP API 라우트가 공유한다. */
export async function updateTaskFieldsCore(
  actor: Actor,
  id: string,
  input: unknown,
) {
  const patch = parsePatch(taskSchema, input);
  // 팀(teamId)과 번호는 생성 후 불변 — patch 에서 제외.
  delete patch.teamId;
  // 담당자 상호배타(B4): 유저 담당자를 지정하면 팀 담당자를 비우고, 반대도 동일.
  // 각 키가 patch 에 실제로 있을 때만(단일 필드 patch 안전) 상대 필드를 null 로 강제한다.
  if ("assigneeId" in patch && patch.assigneeId != null) {
    patch.assigneeTeamId = null;
  }
  if ("assigneeTeamId" in patch && patch.assigneeTeamId != null) {
    patch.assigneeId = null;
  }

  const current = await prisma.task.findUnique({
    where: { id },
    select: TASK_EDITABLE,
  });
  if (!current) throw new Error("태스크를 찾을 수 없습니다");

  const { changes, data } = diffFields(current, patch);
  if (changes.length === 0) return { id };

  // 변경·히스토리·멘션 알림을 한 트랜잭션으로. 알림만 실패하고 변경이 남으면 재시도가
  // 빈 diff 로 끝나 히스토리·알림이 조용히 빠진다(updateAnnouncement 와 같은 이유).
  const task = await prisma.$transaction(async (tx) => {
    const task = await tx.task.update({ where: { id }, data });

    await Promise.all(
      changes.map((c) =>
        logActivity(
          {
            userId: actor.id,
            entityType: "task",
            entityId: id,
            action: "field_changed",
            meta: { field: c.field, from: c.from, to: c.to },
          },
          tx,
        ),
      ),
    );

    // 설명(description) 변경 시 새로 추가된 '@' 멘션 → 알림.
    const descChange = changes.find((c) => c.field === "description");
    if (descChange) {
      await notifyNewMentions(
        {
          actorId: actor.id,
          entityType: "task",
          entityId: id,
          context: task.title,
          before: current.description,
          after: task.description,
        },
        tx,
      );
    }
    return task;
  });

  revalidateTaskPaths(id, task.epicId);
  // 에픽 이동 시 이전 에픽 상세도 무효화.
  if (current.epicId && current.epicId !== task.epicId) {
    revalidatePath(`/epics/${current.epicId}`);
  }
  return { id };
}

/** deleteTask의 actor 주입 코어. 서버 액션과 MCP API 라우트가 공유한다. */
export async function deleteTaskCore(actor: Actor, id: string) {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { reporterId: true, assigneeId: true },
  });
  if (!task) throw new Error("태스크를 찾을 수 없습니다");
  // 삭제는 작성자(reporter)·담당자(assignee) 또는 ADMIN 만.
  assertCanManage(actor, "태스크", task.reporterId, task.assigneeId);
  await prisma.task.delete({ where: { id } });
  await logActivity({
    userId: actor.id,
    entityType: "task",
    entityId: id,
    action: "deleted",
  });
  revalidatePath("/board");
  revalidatePath("/tasks");
}
