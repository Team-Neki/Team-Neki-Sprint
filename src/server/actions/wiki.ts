"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { wikiPageSchema } from "@/lib/validators";
import { logActivity } from "@/server/activity";

const EMPTY_DOC: Prisma.InputJsonValue = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export async function createWikiPage(input: unknown) {
  const user = await requireUser();
  const data = wikiPageSchema.parse(input);

  const siblingCount = await prisma.wikiPage.count({
    where: { parentId: data.parentId },
  });

  const page = await prisma.wikiPage.create({
    data: {
      title: data.title,
      parentId: data.parentId,
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
