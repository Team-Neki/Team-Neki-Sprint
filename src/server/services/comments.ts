// 댓글 쓰기 코어(actor 주입). 서버 액션과 MCP API 라우트가 공유한다.
// use server 지시어가 없어 서버 액션으로 노출되지 않는다 — 클라이언트가 actor 를 위조해 호출할 수 없다.
// ponytail: import 가드는 prisma 가 클라이언트 번들 빌드를 깨는 것으로 대신한다. 명시적 가드가 필요하면 server-only 를 설치해 import.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { taskCommentBodySchema } from "@/lib/validators";
import { logActivity } from "@/server/activity";
import { notifyNewMentions } from "@/server/notify";
import { isValueEmpty } from "@/lib/rich-content";
import type { Actor } from "@/lib/authz";

// 댓글(task/epic/project/sprint 공용). 대댓글 없이 추가만 제공.
// 태스크 전용이던 addComment(actions/tasks.ts)를 다형 Comment 로 일반화한 것.
export type CommentEntityType = "task" | "epic" | "project" | "sprint";

/** 엔티티 상세 경로(revalidate 용). task→/tasks/… 처럼 복수형 세그먼트. */
function entityPath(entityType: CommentEntityType, id: string) {
  return `/${entityType}s/${id}`;
}

/** addEntityComment의 actor 주입 코어. 서버 액션과 MCP API 라우트가 공유한다. */
export async function addEntityCommentCore(
  actor: Actor,
  entityType: CommentEntityType,
  entityId: string,
  body: string,
) {
  const parsed = taskCommentBodySchema.parse(body);
  if (isValueEmpty(parsed)) return;

  // 대상 존재 확인 + 알림 컨텍스트(표시명). 엔티티별로 컬럼이 달라 스위치로 분기한다.
  let context: string | null = null;
  switch (entityType) {
    case "task": {
      const t = await prisma.task.findUnique({
        where: { id: entityId },
        select: { title: true },
      });
      if (!t) throw new Error("대상을 찾을 수 없습니다");
      context = t.title;
      break;
    }
    case "epic": {
      const e = await prisma.epic.findUnique({
        where: { id: entityId },
        select: { title: true },
      });
      if (!e) throw new Error("대상을 찾을 수 없습니다");
      context = e.title;
      break;
    }
    case "project": {
      const p = await prisma.project.findUnique({
        where: { id: entityId },
        select: { title: true },
      });
      if (!p) throw new Error("대상을 찾을 수 없습니다");
      context = p.title;
      break;
    }
    case "sprint": {
      const s = await prisma.sprint.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      if (!s) throw new Error("대상을 찾을 수 없습니다");
      context = s.name;
      break;
    }
  }

  // 댓글과 멘션 알림을 한 트랜잭션으로 — 알림만 실패하고 댓글이 남으면 재시도가 댓글을 중복 생성한다.
  const target = {
    task: { taskId: entityId },
    epic: { epicId: entityId },
    project: { projectId: entityId },
    sprint: { sprintId: entityId },
  }[entityType];
  await prisma.$transaction(async (tx) => {
    await tx.comment.create({
      data: { ...target, body: parsed, authorId: actor.id },
    });
    await notifyNewMentions(
      { actorId: actor.id, entityType, entityId, context, after: parsed },
      tx,
    );
  });

  await logActivity({
    userId: actor.id,
    entityType,
    entityId,
    action: "commented",
  });
  revalidatePath(entityPath(entityType, entityId));
}
