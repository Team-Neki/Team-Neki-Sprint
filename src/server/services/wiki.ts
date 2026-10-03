// 위키 쓰기 코어(actor 주입). 서버 액션과 MCP API 라우트가 공유한다.
// use server 지시어가 없어 서버 액션으로 노출되지 않는다 — 클라이언트가 actor 를 위조해 호출할 수 없다.
// ponytail: import 가드는 prisma 가 클라이언트 번들 빌드를 깨는 것으로 대신한다. 명시적 가드가 필요하면 server-only 를 설치해 import.

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { wikiPageSchema } from "@/lib/validators";
import { logActivity } from "@/server/activity";
import { newMentionRecipients } from "@/server/notify";
import { docToPlainText } from "@/lib/rich-content";
import type { JSONContent } from "@tiptap/core";
import type { Actor } from "@/lib/authz";

const EMPTY_DOC: Prisma.InputJsonValue = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/** 본문의 새 멘션 수신자별 알림 행(B5). 페이지 쓰기와 같은 트랜잭션에서 넣는다. */
function mentionRows(
  recipients: string[],
  actorId: string,
  pageId: string,
  title: string,
) {
  return recipients.map((uid) => ({
    userId: uid,
    actorId,
    type: "mention",
    entityType: "wiki",
    entityId: pageId,
    context: title,
  }));
}

/** createWikiPage의 actor 주입 코어. 서버 액션과 MCP API 라우트가 공유한다.
 * MCP/API 는 본문을 갖고 생성하므로 draft 없이(false) 만들고, 본문(content)을 함께
 * 넘겨 한 번에 쓴다(빈 리비전·'수정' 활동이 생기지 않게). */
export async function createWikiPageCore(
  actor: Actor,
  input: unknown,
  opts?: { draft?: boolean; content?: unknown },
) {
  const data = wikiPageSchema.parse(input);
  const draft = opts?.draft === true;
  const content = opts?.content;

  // 초안 아래에는 하위 페이지를 만들 수 없다(트리에서 버튼을 숨기지만 이중 방어).
  if (data.parentId) {
    const parent = await prisma.wikiPage.findUnique({
      where: { id: data.parentId },
      select: { isDraft: true },
    });
    if (parent?.isDraft) {
      throw new Error("초안 페이지 아래에는 하위 페이지를 만들 수 없습니다");
    }
  }

  // position은 같은 컨테이너(부모 페이지 + 폴더) 안에서만 순서를 맞춘다.
  const siblingCount = await prisma.wikiPage.count({
    where: { parentId: data.parentId, folderId: data.folderId },
  });

  // 초기 본문의 멘션은 빈 문서 대비 전부 새 멘션(수정과 같은 규칙).
  const recipients = content
    ? await newMentionRecipients(EMPTY_DOC, content, actor.id)
    : [];
  const page = await prisma.$transaction(async (tx) => {
    const page = await tx.wikiPage.create({
      data: {
        title: data.title,
        parentId: data.parentId,
        folderId: data.folderId,
        content: (content ?? EMPTY_DOC) as Prisma.InputJsonValue,
        // 전역 검색 본문 매칭용 순수 텍스트 사본(gotchas §16 참조).
        searchText: content ? docToPlainText(content as JSONContent) : "",
        position: siblingCount,
        authorId: actor.id,
        editorId: actor.id,
        isDraft: draft,
      },
    });
    if (recipients.length > 0) {
      await tx.notification.createMany({
        data: mentionRows(recipients, actor.id, page.id, page.title),
      });
    }
    return page;
  });

  // 초안 생성은 활동 로그를 남기지 않는다(취소되면 노이즈) — 첫 커밋 때 남긴다.
  if (!draft) {
    await logActivity({
      userId: actor.id,
      entityType: "wiki",
      entityId: page.id,
      action: "created",
      meta: { title: page.title },
    });
  }

  revalidatePath("/wiki", "layout");
  return { id: page.id };
}

/** updateWikiContent의 actor 주입 코어. 서버 액션과 MCP API 라우트가 공유한다. */
export async function updateWikiContentCore(
  actor: Actor,
  id: string,
  title: string,
  content: unknown,
  /** 클라이언트가 마지막으로 관측한 updatedAt(ISO). 주면 그 뒤 다른 저장이 있었을 때 덮지 않고 conflict. */
  expectedUpdatedAt?: string,
): Promise<{ id: string } | { conflict: true }> {
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
    // 내용이 그대로여도 초안 상태에서 저장(커밋)했다면 정식 페이지로 전환한다.
    // 리비전 스냅샷은 만들지 않는다(빈 초안의 스냅샷은 노이즈).
    if (current.isDraft) {
      await prisma.wikiPage.update({
        where: { id },
        data: { isDraft: false, editorId: actor.id },
      });
      await logActivity({
        userId: actor.id,
        entityType: "wiki",
        entityId: id,
        action: "created",
        meta: { title: nextTitle },
      });
      revalidatePath("/wiki", "layout");
      revalidatePath(`/wiki/${id}`);
    }
    return { id };
  }

  // 본문에 '새로 추가된' 멘션(사람 + 팀→팀원 전원 확장)에 대해 수신자별 알림 생성(B5).
  // 저장 전/후 doc 의 멘션 차집합만 → 재저장마다 중복 알림 방지. 자기멘션 제외.
  const recipients = await newMentionRecipients(
    current.content,
    content,
    actor.id,
  );

  // 페이지 갱신·리비전·알림을 한 트랜잭션으로(알림만 실패하면 재시도가 unchanged 로 빠져 알림이 빠진다).
  // 충돌 검사는 updatedAt 조건부 updateMany 의 count 로 — 읽고 비교한 뒤 쓰면 그 틈의 저장을 덮는다.
  const saved = await prisma.$transaction(async (tx) => {
    const { count } = await tx.wikiPage.updateMany({
      where: {
        id,
        ...(expectedUpdatedAt
          ? { updatedAt: new Date(expectedUpdatedAt) }
          : {}),
      },
      data: {
        title: nextTitle,
        content: content as Prisma.InputJsonValue,
        // 전역 검색 본문 매칭용 순수 텍스트 사본(gotchas §16 참조).
        searchText: docToPlainText(content as JSONContent),
        editorId: actor.id,
        // 첫 저장(커밋)이면 초안 → 정식 전환.
        isDraft: false,
      },
    });
    if (count === 0) return false;

    // Snapshot the previous version before overwriting.
    await tx.wikiRevision.create({
      data: {
        pageId: id,
        title: current.title,
        content: current.content as Prisma.InputJsonValue,
        editorId: current.editorId,
      },
    });
    if (recipients.length > 0) {
      await tx.notification.createMany({
        data: mentionRows(recipients, actor.id, id, nextTitle),
      });
    }
    return true;
  });
  if (!saved) return { conflict: true };

  // 초안의 첫 커밋은 '생성', 그 외에는 '수정' 활동으로 남긴다.
  await logActivity({
    userId: actor.id,
    entityType: "wiki",
    entityId: id,
    action: current.isDraft ? "created" : "updated",
    ...(current.isDraft ? { meta: { title: nextTitle } } : {}),
  });

  // 저장(커밋)했으니 이 유저의 임시저장본은 정리(있으면).
  // deleteMany: 초안이 없는 경우가 정상 흐름(초안 없이 바로 저장)이라 delete 를 쓰면
  // P2025 가 나고, .catch() 로 삼켜도 Prisma 가 예외 전에 prisma:error 를 먼저
  // 출력해 로그가 쌓인다. deleteMany 는 매칭 0건이면 count:0 으로 조용히 끝난다.
  await prisma.wikiDraft.deleteMany({
    where: { pageId: id, userId: actor.id },
  });

  revalidatePath("/wiki", "layout");
  revalidatePath(`/wiki/${id}`);
  return { id };
}
