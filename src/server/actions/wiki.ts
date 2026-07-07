"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { wikiPageSchema, wikiFolderSchema } from "@/lib/validators";
import { searchTasks, searchWikiPages, getWikiRevision } from "@/server/queries";
import { logActivity } from "@/server/activity";

const EMPTY_DOC: Prisma.InputJsonValue = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export async function createWikiPage(input: unknown) {
  const user = await requireUser();
  const data = wikiPageSchema.parse(input);

  // position은 같은 컨테이너(부모 페이지 + 폴더) 안에서만 순서를 맞춘다.
  const siblingCount = await prisma.wikiPage.count({
    where: { parentId: data.parentId, folderId: data.folderId },
  });

  const page = await prisma.wikiPage.create({
    data: {
      title: data.title,
      parentId: data.parentId,
      folderId: data.folderId,
      content: EMPTY_DOC,
      position: siblingCount,
      authorId: user.id,
      editorId: user.id,
    },
  });

  await logActivity({
    userId: user.id,
    entityType: "wiki",
    entityId: page.id,
    action: "created",
    meta: { title: page.title },
  });

  revalidatePath("/wiki", "layout");
  return { id: page.id };
}

export async function updateWikiContent(
  id: string,
  title: string,
  content: unknown,
) {
  const user = await requireUser();

  const current = await prisma.wikiPage.findUnique({ where: { id } });
  if (!current) throw new Error("페이지를 찾을 수 없습니다");

  const nextTitle = title.trim() || "제목 없음";

  // 핵심: 실제 변경이 없으면(제목·본문 동일) DB 쓰기 자체를 건너뛴다.
  // 에디터가 1.5초 디바운스로 자동저장하므로, 가드가 없으면 편집이 없어도
  // 매 저장마다 리비전이 1건씩 쌓인다.
  const unchanged =
    current.title === nextTitle &&
    JSON.stringify(current.content) === JSON.stringify(content);
  if (unchanged) {
    return { id };
  }

  // Snapshot the previous version before overwriting.
  await prisma.wikiRevision.create({
    data: {
      pageId: id,
      title: current.title,
      content: current.content as Prisma.InputJsonValue,
      editorId: current.editorId,
    },
  });

  await prisma.wikiPage.update({
    where: { id },
    data: {
      title: nextTitle,
      content: content as Prisma.InputJsonValue,
      editorId: user.id,
    },
  });

  await logActivity({
    userId: user.id,
    entityType: "wiki",
    entityId: id,
    action: "updated",
  });

  revalidatePath("/wiki", "layout");
  revalidatePath(`/wiki/${id}`);
  return { id };
}

/** 페이지 제목만 변경(사이드바 이름 변경). 본문 리비전은 남기지 않는 경량 액션. */
export async function renameWikiPage(id: string, title: string) {
  const user = await requireUser();
  const nextTitle = title.trim() || "제목 없음";
  await prisma.wikiPage.update({
    where: { id },
    data: { title: nextTitle, editorId: user.id },
  });
  await logActivity({
    userId: user.id,
    entityType: "wiki",
    entityId: id,
    action: "updated",
  });
  revalidatePath("/wiki", "layout");
  revalidatePath(`/wiki/${id}`);
}

export async function deleteWikiPage(id: string) {
  const user = await requireUser();
  await prisma.wikiPage.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    entityType: "wiki",
    entityId: id,
    action: "deleted",
  });
  revalidatePath("/wiki", "layout");
}

/** 페이지를 폴더에 넣거나 뺀다(folderId=null 이면 폴더 밖으로). */
export async function movePageToFolder(pageId: string, folderId: string | null) {
  await requireUser();
  await prisma.wikiPage.update({
    where: { id: pageId },
    data: { folderId },
  });
  revalidatePath("/wiki", "layout");
  revalidatePath(`/wiki/${pageId}`);
}

// ---------- 폴더(#2) ----------

export async function createWikiFolder(input: unknown) {
  await requireUser();
  const data = wikiFolderSchema.parse(input);

  const siblingCount = await prisma.wikiFolder.count({
    where: { parentId: data.parentId },
  });

  const folder = await prisma.wikiFolder.create({
    data: {
      name: data.name,
      parentId: data.parentId,
      position: siblingCount,
    },
  });

  revalidatePath("/wiki", "layout");
  return { id: folder.id };
}

export async function renameWikiFolder(id: string, name: string) {
  await requireUser();
  const nextName = name.trim();
  if (!nextName) throw new Error("폴더 이름을 입력하세요");
  await prisma.wikiFolder.update({ where: { id }, data: { name: nextName } });
  revalidatePath("/wiki", "layout");
}

/**
 * 폴더 삭제. 하위 폴더는 함께 삭제(Cascade)되지만, 폴더에 담긴 페이지는
 * folderId만 null로 풀리고 보존된다(schema onDelete: SetNull). 문서는 사라지지 않는다.
 */
export async function deleteWikiFolder(id: string) {
  await requireUser();
  await prisma.wikiFolder.delete({ where: { id } });
  revalidatePath("/wiki", "layout");
}

// ---------- 티켓 ↔ 위키 링크(#3) ----------

export async function linkTaskToPage(pageId: string, taskId: string) {
  await requireUser();
  // 이미 있으면 무시(멱등). @@id([pageId, taskId]) 이므로 중복 생성은 실패한다.
  await prisma.wikiPageTaskLink.upsert({
    where: { pageId_taskId: { pageId, taskId } },
    update: {},
    create: { pageId, taskId },
  });
  revalidatePath(`/wiki/${pageId}`);
  revalidatePath(`/tasks/${taskId}`);
}

export async function unlinkTaskFromPage(pageId: string, taskId: string) {
  await requireUser();
  await prisma.wikiPageTaskLink.delete({
    where: { pageId_taskId: { pageId, taskId } },
  });
  revalidatePath(`/wiki/${pageId}`);
  revalidatePath(`/tasks/${taskId}`);
}

// ---------- 즐겨찾기(별표) ----------

/**
 * 현재 유저 기준 별표 토글. 이미 있으면 해제(delete), 없으면 별표(create).
 * 반환값 favorited 로 클라이언트가 즉시 새 상태를 반영할 수 있다.
 */
export async function toggleWikiFavorite(pageId: string) {
  const user = await requireUser();
  const key = { userId_pageId: { userId: user.id, pageId } };
  const existing = await prisma.wikiFavorite.findUnique({ where: key });
  if (existing) {
    await prisma.wikiFavorite.delete({ where: key });
  } else {
    await prisma.wikiFavorite.create({
      data: { userId: user.id, pageId },
    });
  }
  revalidatePath("/wiki", "layout");
  revalidatePath(`/wiki/${pageId}`);
  return { favorited: !existing };
}

// ---------- 버전 기록(리비전) ----------

/**
 * 과거 리비전 내용을 현재로 되돌린다. 되돌리기 전 현재 상태를 새 리비전으로
 * 스냅샷한 뒤(안전장치) 페이지 내용을 리비전 내용으로 덮어쓴다 — 복원도 하나의
 * 새 편집으로 취급(editorId=현재 유저).
 */
export async function restoreWikiRevision(revisionId: string) {
  const user = await requireUser();

  const rev = await prisma.wikiRevision.findUnique({ where: { id: revisionId } });
  if (!rev) throw new Error("리비전을 찾을 수 없습니다");

  const current = await prisma.wikiPage.findUnique({ where: { id: rev.pageId } });
  if (!current) throw new Error("페이지를 찾을 수 없습니다");

  // 되돌리기 전 현재 상태를 스냅샷(복원 취소를 위한 안전장치).
  await prisma.wikiRevision.create({
    data: {
      pageId: rev.pageId,
      title: current.title,
      content: current.content as Prisma.InputJsonValue,
      editorId: current.editorId,
    },
  });

  await prisma.wikiPage.update({
    where: { id: rev.pageId },
    data: {
      title: rev.title,
      content: rev.content as Prisma.InputJsonValue,
      editorId: user.id,
    },
  });

  await logActivity({
    userId: user.id,
    entityType: "wiki",
    entityId: rev.pageId,
    action: "updated",
    meta: { restoredFrom: revisionId },
  });

  revalidatePath("/wiki", "layout");
  revalidatePath(`/wiki/${rev.pageId}`);
  return { id: rev.pageId };
}

/** 단일 리비전 내용 조회(클라이언트 버전 미리보기에서 호출). */
export async function getWikiRevisionAction(id: string) {
  await requireUser();
  return getWikiRevision(id);
}

// ---------- 검색 액션(클라이언트에서 호출: 링크 UI + 에디터 #) ----------

export async function searchTasksAction(query: string) {
  await requireUser();
  return searchTasks(query);
}

export async function searchWikiPagesAction(query: string) {
  await requireUser();
  return searchWikiPages(query);
}
