"use server";

import { revalidatePath } from "next/cache";
import type { Status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logActivity } from "@/server/activity";
import { wouldCreateCycle } from "@/lib/task-deps";
import { formatIssueKey } from "@/lib/constants";
import {
  createTaskCore,
  updateTaskFieldsCore,
  deleteTaskCore,
} from "@/server/services/tasks";

export async function createTask(input: unknown) {
  const user = await requireUser();
  return createTaskCore(user, input);
}

/** 다이얼로그 저장. 인라인 편집과 같은 코어로 필드별 히스토리·멘션 알림·담당자 상호배타를 적용한다. */
export async function updateTask(id: string, input: unknown) {
  const user = await requireUser();
  return updateTaskFieldsCore(user, id, input);
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

/**
 * 상세 페이지 인라인 편집(B3)의 단일 진입점: 부분 patch 를 현재 값과 diff 해
 * 바뀐 필드만 update 하고, 필드별 before→after 를 Activity(`field_changed`)로 기록(B8).
 * 인라인 편집기는 단일 필드 patch(예: `{ status }`)로 호출한다.
 */
export async function updateTaskFields(id: string, input: unknown) {
  const user = await requireUser();
  return updateTaskFieldsCore(user, id, input);
}

export async function deleteTask(id: string) {
  const user = await requireUser();
  return deleteTaskCore(user, id);
}

// 댓글 추가는 다형 Comment 로 일반화되어 actions/comments.ts 의 addEntityComment 로 이동.
// (task/epic/project/sprint 공용)

// ---------- 의존성(blocks / blockedBy) ----------

/**
 * 의존성 엣지 추가: blocker 가 blocked 를 막는다(blocked 는 blocker 완료 전 진행 불가).
 * 자기참조·순환은 거부(lib/task-deps wouldCreateCycle). 중복은 멱등(upsert no-op).
 * UI 는 방향에 따라 인자 순서를 맞춰 호출한다(차단하는 항목 추가=현재가 blocked,
 * 차단되는 항목 추가=현재가 blocker).
 */
// 의존성 활동 로그용 태스크 표시 정보(key + 제목).
const depTaskSelect = {
  id: true,
  number: true,
  title: true,
  team: { select: { key: true } },
} as const;

type DepTaskInfo = {
  id: string;
  number: number;
  title: string;
  team: { key: string } | null;
};

/**
 * 의존성 add/remove 를 양쪽 태스크 히스토리에 기록. blocked 쪽엔 'blockedBy'(차단 항목),
 * blocker 쪽엔 'blocking'(차단하는 항목)로 남겨 각 상세에서 상대 방향으로 읽힌다.
 * meta 에 상대 태스크의 key·title 을 박아 activity-format 이 lookup 없이 렌더한다.
 */
async function logDependencyChange(
  userId: string,
  action: "dependency_added" | "dependency_removed",
  blocker: DepTaskInfo,
  blocked: DepTaskInfo,
) {
  await Promise.all([
    logActivity({
      userId,
      entityType: "task",
      entityId: blocked.id,
      action,
      meta: {
        role: "blockedBy",
        key: formatIssueKey(blocker.team?.key, blocker.number),
        title: blocker.title,
      },
    }),
    logActivity({
      userId,
      entityType: "task",
      entityId: blocker.id,
      action,
      meta: {
        role: "blocking",
        key: formatIssueKey(blocked.team?.key, blocked.number),
        title: blocked.title,
      },
    }),
  ]);
}

function revalidateDepPaths(blockerId: string, blockedId: string) {
  revalidatePath(`/tasks/${blockerId}`);
  revalidatePath(`/tasks/${blockedId}`);
  revalidatePath("/tasks");
  revalidatePath("/board");
}

export async function addTaskDependency(blockerId: string, blockedId: string) {
  const user = await requireUser();
  if (!blockerId || !blockedId) throw new Error("태스크를 선택하세요");
  if (blockerId === blockedId)
    throw new Error("자기 자신에는 의존성을 걸 수 없습니다");

  const tasks = await prisma.task.findMany({
    where: { id: { in: [blockerId, blockedId] } },
    select: depTaskSelect,
  });
  const blocker = tasks.find((t) => t.id === blockerId);
  const blocked = tasks.find((t) => t.id === blockedId);
  if (!blocker || !blocked) throw new Error("태스크를 찾을 수 없습니다");

  // 순환 방지: 현재 전체 엣지를 로드해 검사(그래프가 작아 저렴).
  const edges = await prisma.taskDependency.findMany({
    select: { blockerId: true, blockedId: true },
  });
  if (wouldCreateCycle(edges, blockerId, blockedId)) {
    throw new Error("순환 의존성은 만들 수 없습니다");
  }

  await prisma.taskDependency.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });

  await logDependencyChange(user.id, "dependency_added", blocker, blocked);
  revalidateDepPaths(blockerId, blockedId);
  return { blockerId, blockedId };
}

/** 의존성 엣지 제거. 대상이 없어도 예외 없이 통과(멱등). */
export async function removeTaskDependency(
  blockerId: string,
  blockedId: string,
) {
  const user = await requireUser();
  const { count } = await prisma.taskDependency.deleteMany({
    where: { blockerId, blockedId },
  });

  // 실제로 지워졌을 때만 활동 기록(태스크가 이미 삭제됐으면 조용히 건너뜀).
  if (count > 0) {
    const tasks = await prisma.task.findMany({
      where: { id: { in: [blockerId, blockedId] } },
      select: depTaskSelect,
    });
    const blocker = tasks.find((t) => t.id === blockerId);
    const blocked = tasks.find((t) => t.id === blockedId);
    if (blocker && blocked) {
      await logDependencyChange(
        user.id,
        "dependency_removed",
        blocker,
        blocked,
      );
    }
  }

  revalidateDepPaths(blockerId, blockedId);
  return { blockerId, blockedId };
}

/**
 * 티켓 참조(c.c.) 수신자 집합 설정. 편집은 팀 전체에 개방(삭제만 제한 정책)이라
 * 별도 소유자 게이트 없이 로그인 사용자면 변경 가능하다. userIds 로 전체 목록을 교체.
 */
export async function setTaskCc(taskId: string, userIds: string[]) {
  const user = await requireUser();
  const ids = [
    ...new Set((userIds ?? []).filter((u) => typeof u === "string" && u)),
  ];
  await prisma.task.update({
    where: { id: taskId },
    data: { ccUsers: { set: ids.map((id) => ({ id })) } },
  });
  await logActivity({
    userId: user.id,
    entityType: "task",
    entityId: taskId,
    action: "updated",
    meta: { field: "cc" },
  });
  revalidatePath(`/tasks/${taskId}`);
  return { id: taskId };
}
