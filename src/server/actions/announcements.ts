"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import type { JSONContent } from "@tiptap/core";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { newMentionRecipients } from "@/server/notify";

const EMPTY_DOC: Prisma.InputJsonValue = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/** 공지 관련 화면 재검증(대시보드 목록 + 전체 목록 + 상세). */
function revalidateAnnouncements(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/announcements");
  if (id) revalidatePath(`/announcements/${id}`);
}

/**
 * 새 공지 생성(위키의 new-page-button 패턴). 빈 문서로 만들고 상세로 이동해
 * 편집 모드에서 작성한다. 등록은 모든 멤버 가능.
 */
export async function createAnnouncement() {
  const user = await requireUser();
  const announcement = await prisma.announcement.create({
    data: {
      title: "제목 없음",
      content: EMPTY_DOC,
      authorId: user.id,
    },
  });
  revalidateAnnouncements();
  return { id: announcement.id };
}

/** 공지 수정. 모든 멤버 가능(삭제만 작성자 제한). 변경 없으면 쓰기 생략. */
export async function updateAnnouncement(
  id: string,
  title: string,
  content: unknown,
) {
  const user = await requireUser();
  const current = await prisma.announcement.findUnique({ where: { id } });
  if (!current) throw new Error("공지를 찾을 수 없습니다");

  const nextTitle = title.trim() || "제목 없음";
  const unchanged =
    current.title === nextTitle &&
    JSON.stringify(current.content) === JSON.stringify(content);
  if (unchanged) return { id };

  await prisma.announcement.update({
    where: { id },
    data: {
      title: nextTitle,
      content: content as Prisma.InputJsonValue,
    },
  });

  // 본문에 '새로 추가된' 멘션(사람 + 팀 확장)에 알림. 위키와 동일 규칙(B5).
  const recipients = await newMentionRecipients(
    current.content as JSONContent,
    content,
    user.id,
  );
  if (recipients.length > 0) {
    await prisma.notification.createMany({
      data: recipients.map((uid) => ({
        userId: uid,
        actorId: user.id,
        type: "mention",
        entityType: "announcement",
        entityId: id,
        context: nextTitle,
      })),
    });
  }

  revalidateAnnouncements(id);
  return { id };
}

/**
 * 공지 삭제 — **작성자만** 가능(요구사항). 작성자가 탈퇴 등으로 사라진(null) 공지는
 * ADMIN 이 정리할 수 있게 예외를 둔다.
 */
export async function deleteAnnouncement(id: string) {
  const user = await requireUser();
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    select: { authorId: true },
  });
  if (!announcement) throw new Error("공지를 찾을 수 없습니다");

  const allowed = announcement.authorId
    ? announcement.authorId === user.id
    : user.role === "ADMIN";
  if (!allowed) {
    throw new Error("공지는 등록한 사람만 삭제할 수 있습니다.");
  }

  await prisma.announcement.delete({ where: { id } });
  revalidateAnnouncements();
}
