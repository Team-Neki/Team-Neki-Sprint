"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { wikiCommentBodySchema } from "@/lib/validators";
import { logActivity } from "@/server/activity";

/**
 * B10 위키 인라인 댓글 서버 액션.
 *
 * 앵커(하이라이트)는 위키 문서 content 안의 commentMark 에 threadId 로 저장되고,
 * 스레드 메타/댓글은 아래 액션이 다룬다. 앵커 삽입/삭제는 뷰 컴포넌트가 에디터에
 * 마크를 적용한 뒤 saveWikiCommentAnchors 로 content 만 저장한다(리비전·알림 없이).
 */

/** 스레드 생성 + 첫 댓글. threadId 를 돌려주면 클라이언트가 그 id 로 마크를 씌운다. */
export async function createWikiCommentThread(
  pageId: string,
  quote: string,
  body: string,
) {
  const user = await requireUser();
  const text = wikiCommentBodySchema.parse(body);

  const page = await prisma.wikiPage.findUnique({
    where: { id: pageId },
    select: { id: true },
  });
  if (!page) throw new Error("페이지를 찾을 수 없습니다");

  const thread = await prisma.wikiCommentThread.create({
    data: {
      pageId,
      quote: quote.slice(0, 300),
      comments: {
        create: { authorId: user.id, body: text },
      },
    },
  });

  await logActivity({
    userId: user.id,
    entityType: "wiki",
    entityId: pageId,
    action: "commented",
  });

  revalidatePath(`/wiki/${pageId}`);
  return { threadId: thread.id };
}

/** 스레드에 답글 추가. */
export async function addWikiCommentReply(threadId: string, body: string) {
  const user = await requireUser();
  const text = wikiCommentBodySchema.parse(body);

  const thread = await prisma.wikiCommentThread.findUnique({
    where: { id: threadId },
    select: { pageId: true },
  });
  if (!thread) throw new Error("스레드를 찾을 수 없습니다");

  await prisma.wikiComment.create({
    data: { threadId, authorId: user.id, body: text },
  });
  // 답글이 달리면 스레드 updatedAt 을 밀어 최근 활동 순서를 유지.
  await prisma.wikiCommentThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });

  revalidatePath(`/wiki/${thread.pageId}`);
  return { ok: true };
}

/** 스레드 해결/재오픈 토글. 앵커 마크는 유지하고 뷰에서 dim 처리한다(재오픈 가능). */
export async function resolveWikiCommentThread(
  threadId: string,
  resolved: boolean,
) {
  await requireUser();
  const thread = await prisma.wikiCommentThread.update({
    where: { id: threadId },
    data: { resolved },
    select: { pageId: true },
  });
  revalidatePath(`/wiki/${thread.pageId}`);
  return { ok: true };
}

/** 답글 1건 삭제(작성자 본인만). 스레드 첫 댓글은 UI에서 삭제 불가(스레드 삭제로). */
export async function deleteWikiComment(commentId: string) {
  const user = await requireUser();
  const comment = await prisma.wikiComment.findUnique({
    where: { id: commentId },
    select: { authorId: true, thread: { select: { pageId: true } } },
  });
  if (!comment) throw new Error("댓글을 찾을 수 없습니다");
  if (comment.authorId !== user.id)
    throw new Error("본인 댓글만 삭제할 수 있습니다");

  await prisma.wikiComment.delete({ where: { id: commentId } });
  revalidatePath(`/wiki/${comment.thread.pageId}`);
  return { ok: true };
}

/**
 * 스레드 전체 삭제(댓글 cascade). 앵커 마크 제거는 클라이언트가 마크를 걷어낸 뒤
 * saveWikiCommentAnchors 로 content 를 저장해 반영한다.
 */
export async function deleteWikiCommentThread(threadId: string) {
  await requireUser();
  const thread = await prisma.wikiCommentThread.findUnique({
    where: { id: threadId },
    select: { pageId: true },
  });
  if (!thread) return { ok: true };
  await prisma.wikiCommentThread.delete({ where: { id: threadId } });
  revalidatePath(`/wiki/${thread.pageId}`);
  return { ok: true };
}

/**
 * 댓글 앵커(commentMark)만 반영하기 위한 content 저장. 리비전·알림 없이 본문 JSON 만
 * 갱신한다(일반 편집 저장 updateWikiContent 와 구분 — 앵커 추가로 리비전이 쌓이지 않게).
 * content 는 클라이언트에서 순수 JSON 으로 클론해 넘긴다(RSC 직렬화, gotchas §7).
 *
 * 낙관적 동시성(A3): 앵커 저장은 content 를 통째로 덮어쓰는 last-write-wins 라, 클라이언트가
 * 본문을 로드한 뒤 댓글을 다는 사이 다른 사용자가 본문을 저장하면 그 편집이 조용히 되돌아간다.
 * 이를 막기 위해 클라이언트가 마지막으로 관측한 updatedAt(ISO 문자열, RSC 경계 직렬화)을 받아
 * 현재 값과 대조한다. 다르면(중간에 저장 발생) 덮어쓰지 않고 conflict 를 돌려주고, 같으면 저장 후
 * 새 updatedAt 을 돌려줘 클라이언트가 기준선을 갱신하도록 한다.
 */
export async function saveWikiCommentAnchors(
  pageId: string,
  content: unknown,
  expectedUpdatedAt: string,
): Promise<
  { ok: true; updatedAt: string } | { ok: false; conflict: true }
> {
  await requireUser();

  const current = await prisma.wikiPage.findUnique({
    where: { id: pageId },
    select: { updatedAt: true },
  });
  if (!current) throw new Error("페이지를 찾을 수 없습니다");

  // 기준선 불일치 = 그 사이 누군가 본문을 저장함 → 덮어쓰기 거부(그 편집 보존).
  if (current.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    return { ok: false, conflict: true };
  }

  const updated = await prisma.wikiPage.update({
    where: { id: pageId },
    data: { content: content as Prisma.InputJsonValue },
    select: { updatedAt: true },
  });
  revalidatePath(`/wiki/${pageId}`);
  return { ok: true, updatedAt: updated.updatedAt.toISOString() };
}
