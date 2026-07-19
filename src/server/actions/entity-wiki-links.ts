"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

// 엔티티↔위키 링크(sprint/project/epic). 태스크의 linkTaskToPage/unlinkTaskFromPage
// (actions/wiki.ts)와 동형이며, 태스크 외 엔티티에 대해 조인 테이블만 갈아끼운다.
// 태스크는 기존 액션을 그대로 쓰고 여기 대상에서 제외한다.
export type LinkEntityType = "epic" | "project" | "sprint";

/** 엔티티 상세 경로(revalidate 용). epic→/epics/… 처럼 복수형 세그먼트. */
function entityPath(entityType: LinkEntityType, entityId: string) {
  return `/${entityType}s/${entityId}`;
}

/** 위키 페이지를 엔티티에 연결(멱등 upsert). @@id 복합키라 중복 생성은 실패하므로 upsert. */
export async function linkPageToEntity(
  entityType: LinkEntityType,
  entityId: string,
  pageId: string,
) {
  await requireUser();
  switch (entityType) {
    case "epic":
      await prisma.wikiPageEpicLink.upsert({
        where: { pageId_epicId: { pageId, epicId: entityId } },
        update: {},
        create: { pageId, epicId: entityId },
      });
      break;
    case "project":
      await prisma.wikiPageProjectLink.upsert({
        where: { pageId_projectId: { pageId, projectId: entityId } },
        update: {},
        create: { pageId, projectId: entityId },
      });
      break;
    case "sprint":
      await prisma.wikiPageSprintLink.upsert({
        where: { pageId_sprintId: { pageId, sprintId: entityId } },
        update: {},
        create: { pageId, sprintId: entityId },
      });
      break;
  }
  revalidatePath(entityPath(entityType, entityId));
  revalidatePath(`/wiki/${pageId}`);
}

/** 연결 해제. 대상이 없어도 조용히 통과(멱등). */
export async function unlinkPageFromEntity(
  entityType: LinkEntityType,
  entityId: string,
  pageId: string,
) {
  await requireUser();
  switch (entityType) {
    case "epic":
      await prisma.wikiPageEpicLink.deleteMany({
        where: { pageId, epicId: entityId },
      });
      break;
    case "project":
      await prisma.wikiPageProjectLink.deleteMany({
        where: { pageId, projectId: entityId },
      });
      break;
    case "sprint":
      await prisma.wikiPageSprintLink.deleteMany({
        where: { pageId, sprintId: entityId },
      });
      break;
  }
  revalidatePath(entityPath(entityType, entityId));
  revalidatePath(`/wiki/${pageId}`);
}
