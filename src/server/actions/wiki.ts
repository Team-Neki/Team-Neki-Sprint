"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { wikiPageSchema, wikiFolderSchema } from "@/lib/validators";
import {
  searchTasks,
  searchWikiPages,
  searchMembers,
  getWikiRevision,
} from "@/server/queries";
import { logActivity } from "@/server/activity";
import { extractMentionUserIds } from "@/lib/mentions";
import { docToPlainText } from "@/lib/rich-content";
import type { JSONContent } from "@tiptap/core";
import { assertCanManage } from "@/lib/authz";
import { bumpTags, CACHE_TAGS } from "@/lib/cache";

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
      searchText: "",
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
  bumpTags(CACHE_TAGS.wiki);
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
      // 전역 검색 본문 매칭용 순수 텍스트 사본(gotchas §16 참조).
      searchText: docToPlainText(content as JSONContent),
      editorId: user.id,
    },
  });

  await logActivity({
    userId: user.id,
    entityType: "wiki",
    entityId: id,
    action: "updated",
  });

  // 본문에 '새로 추가된' 사람 멘션에 대해 수신자별 알림 생성(B5).
  // 저장 전/후 doc 의 멘션 차집합만 → 재저장마다 중복 알림 방지. 자기멘션 제외.
  const before = extractMentionUserIds(current.content);
  const after = extractMentionUserIds(content);
  const added = [...after].filter((uid) => !before.has(uid) && uid !== user.id);
  if (added.length > 0) {
    await prisma.notification.createMany({
      data: added.map((uid) => ({
        userId: uid,
        actorId: user.id,
        type: "mention",
        entityType: "wiki",
        entityId: id,
        context: nextTitle,
      })),
    });
  }

  // 저장(커밋)했으니 이 유저의 임시저장본은 정리(있으면).
  await prisma.wikiDraft
    .delete({ where: { pageId_userId: { pageId: id, userId: user.id } } })
    .catch(() => {});

  revalidatePath("/wiki", "layout");
  bumpTags(CACHE_TAGS.wiki);
  revalidatePath(`/wiki/${id}`);
  return { id };
}

// ---------- 편집 임시저장본(draft) ----------

/** 편집 중 임시저장본 upsert(유저×페이지 1건). 디바운스로 호출. content 는 순수 JSON 클론. */
export async function saveWikiDraft(
  pageId: string,
  title: string,
  content: unknown,
) {
  const user = await requireUser();
  await prisma.wikiDraft.upsert({
    where: { pageId_userId: { pageId, userId: user.id } },
    update: { title, content: content as Prisma.InputJsonValue },
    create: {
      pageId,
      userId: user.id,
      title,
      content: content as Prisma.InputJsonValue,
    },
  });
  return { ok: true };
}

/** 임시저장본 폐기('취소' 또는 저장 완료 시). */
export async function discardWikiDraft(pageId: string) {
  const user = await requireUser();
  await prisma.wikiDraft
    .delete({ where: { pageId_userId: { pageId, userId: user.id } } })
    .catch(() => {});
  return { ok: true };
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
  bumpTags(CACHE_TAGS.wiki);
  revalidatePath(`/wiki/${id}`);
}

/** 페이지 id → 자신 + 모든 후손 페이지 id(BFS). soft-delete/복원 서브트리 계산용. */
async function collectSubtreeIds(rootId: string): Promise<string[]> {
  const all = await prisma.wikiPage.findMany({
    select: { id: true, parentId: true },
  });
  const childrenOf = new Map<string, string[]>();
  for (const p of all) {
    if (!p.parentId) continue;
    const list = childrenOf.get(p.parentId);
    if (list) list.push(p.id);
    else childrenOf.set(p.parentId, [p.id]);
  }
  const ids = [rootId];
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop() as string;
    const kids = childrenOf.get(cur);
    if (kids) {
      ids.push(...kids);
      stack.push(...kids);
    }
  }
  return ids;
}

/**
 * soft-delete: 페이지를 휴지통으로 이동. 하위(재귀) 페이지도 함께 이동한다.
 * 하드 삭제가 아니므로 복원 가능(restoreWikiPage). 휴지통 목록/영구삭제는 /wiki/trash.
 */
export async function deleteWikiPage(id: string) {
  const user = await requireUser();
  const page = await prisma.wikiPage.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!page) throw new Error("페이지를 찾을 수 없습니다");
  // 휴지통 이동(soft delete)은 작성자(author) 또는 ADMIN 만.
  assertCanManage(user, "위키 페이지", page.authorId);
  const ids = await collectSubtreeIds(id);
  await prisma.wikiPage.updateMany({
    where: { id: { in: ids } },
    data: { deletedAt: new Date() },
  });
  await logActivity({
    userId: user.id,
    entityType: "wiki",
    entityId: id,
    action: "trashed",
  });
  revalidatePath("/wiki", "layout");
  bumpTags(CACHE_TAGS.wiki);
}

/** 휴지통에서 복원: 페이지 + 함께 삭제됐던 후손(deletedAt != null) 복구. */
export async function restoreWikiPage(id: string) {
  const user = await requireUser();
  const ids = await collectSubtreeIds(id);
  await prisma.wikiPage.updateMany({
    where: { id: { in: ids }, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  await logActivity({
    userId: user.id,
    entityType: "wiki",
    entityId: id,
    action: "restored",
  });
  revalidatePath("/wiki", "layout");
  bumpTags(CACHE_TAGS.wiki);
  revalidatePath(`/wiki/${id}`);
}

/** 휴지통에서 영구 삭제(하드). 하위 페이지·리비전·댓글 등 cascade 로 함께 삭제. */
export async function purgeWikiPage(id: string) {
  const user = await requireUser();
  const page = await prisma.wikiPage.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!page) throw new Error("페이지를 찾을 수 없습니다");
  // 영구 삭제(하드·cascade)는 작성자(author) 또는 ADMIN 만.
  assertCanManage(user, "위키 페이지", page.authorId);
  await prisma.wikiPage.delete({ where: { id } });
  await logActivity({
    userId: user.id,
    entityType: "wiki",
    entityId: id,
    action: "deleted",
  });
  revalidatePath("/wiki", "layout");
  bumpTags(CACHE_TAGS.wiki);
}

/** 페이지를 폴더에 넣거나 뺀다(folderId=null 이면 폴더 밖으로). */
export async function movePageToFolder(pageId: string, folderId: string | null) {
  await requireUser();
  await prisma.wikiPage.update({
    where: { id: pageId },
    data: { folderId },
  });
  revalidatePath("/wiki", "layout");
  bumpTags(CACHE_TAGS.wiki);
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
  bumpTags(CACHE_TAGS.wiki);
  return { id: folder.id };
}

export async function renameWikiFolder(id: string, name: string) {
  await requireUser();
  const nextName = name.trim();
  if (!nextName) throw new Error("폴더 이름을 입력하세요");
  await prisma.wikiFolder.update({ where: { id }, data: { name: nextName } });
  revalidatePath("/wiki", "layout");
  bumpTags(CACHE_TAGS.wiki);
}

/**
 * 폴더 삭제. 하위 폴더는 함께 삭제(Cascade)되지만, 폴더에 담긴 페이지는
 * folderId만 null로 풀리고 보존된다(schema onDelete: SetNull). 문서는 사라지지 않는다.
 */
export async function deleteWikiFolder(id: string) {
  await requireUser();
  await prisma.wikiFolder.delete({ where: { id } });
  revalidatePath("/wiki", "layout");
  bumpTags(CACHE_TAGS.wiki);
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
  bumpTags(CACHE_TAGS.wiki);
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
      // 되돌린 본문으로 검색 텍스트도 함께 갱신.
      searchText: docToPlainText(rev.content as JSONContent),
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
  bumpTags(CACHE_TAGS.wiki);
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

/** '@' 사람 멘션 드롭다운(B5). */
export async function searchMembersAction(query: string) {
  await requireUser();
  return searchMembers(query);
}
