"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { taskCommentBodySchema } from "@/lib/validators";
import { logActivity } from "@/server/activity";
import { notifyNewMentions } from "@/server/notify";
import { isValueEmpty } from "@/lib/rich-content";

// 댓글(task/epic/project/sprint 공용). 대댓글 없이 추가만 제공.
// 태스크 전용이던 addComment(actions/tasks.ts)를 다형 Comment 로 일반화한 것.
export type CommentEntityType = "task" | "epic" | "project" | "sprint";

/** 엔티티 상세 경로(revalidate 용). task→/tasks/… 처럼 복수형 세그먼트. */
function entityPath(entityType: CommentEntityType, id: string) {
  return `/${entityType}s/${id}`;
}

/**
 * 댓글 추가. body 는 Tiptap doc JSON 문자열(B6). 빈 문서면 무시.
 * 본문의 '@' 멘션(사람/팀)은 수신자 알림으로(자기멘션 제외) — 태스크 댓글과 동일.
 * '#' 티켓/위키 멘션은 링크일 뿐 알림 대상 아님(기존 정책 유지).
 */
export async function addEntityComment(
  entityType: CommentEntityType,
  entityId: string,
  body: string,
) {
  const user = await requireUser();
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
      await prisma.comment.create({
        data: { taskId: entityId, body: parsed, authorId: user.id },
      });
      break;
    }
    case "epic": {
      const e = await prisma.epic.findUnique({
        where: { id: entityId },
        select: { title: true },
      });
      if (!e) throw new Error("대상을 찾을 수 없습니다");
      context = e.title;
      await prisma.comment.create({
        data: { epicId: entityId, body: parsed, authorId: user.id },
      });
      break;
    }
    case "project": {
      const p = await prisma.project.findUnique({
        where: { id: entityId },
        select: { title: true },
      });
      if (!p) throw new Error("대상을 찾을 수 없습니다");
      context = p.title;
      await prisma.comment.create({
        data: { projectId: entityId, body: parsed, authorId: user.id },
      });
      break;
    }
    case "sprint": {
      const s = await prisma.sprint.findUnique({
        where: { id: entityId },
        select: { name: true },
      });
      if (!s) throw new Error("대상을 찾을 수 없습니다");
      context = s.name;
      await prisma.comment.create({
        data: { sprintId: entityId, body: parsed, authorId: user.id },
      });
      break;
    }
  }

  await logActivity({
    userId: user.id,
    entityType,
    entityId,
    action: "commented",
  });
  await notifyNewMentions({
    actorId: user.id,
    entityType,
    entityId,
    context,
    after: parsed,
  });
  revalidatePath(entityPath(entityType, entityId));
}
