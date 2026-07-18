"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import type { JSONContent } from "@tiptap/core";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isRichDoc } from "@/lib/validators";
import { newMentionRecipients } from "@/server/notify";

/** 공지 관련 화면 재검증(대시보드 목록 + 전체 목록 + 상세). */
function revalidateAnnouncements(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/announcements");
  if (id) revalidatePath(`/announcements/${id}`);
}

/**
 * 새 공지 생성. 이전엔 '공지 작성' 클릭 즉시 빈 공지를 만들어(취소해도 남던 문제),
 * 이제 /announcements/new 편집 화면에서 '저장'을 눌러야 이 액션이 호출돼 실제로 생성된다.
 * 초기 본문의 멘션(사람+팀)에도 알림. 등록은 모든 멤버 가능.
 */
export async function createAnnouncement(title: string, content: unknown) {
  const user = await requireUser();
  if (!isRichDoc(content)) throw new Error("본문 형식이 올바르지 않습니다");
  const announcement = await prisma.announcement.create({
    data: {
      title: title.trim() || "제목 없음",
      content: content as Prisma.InputJsonValue,
      authorId: user.id,
    },
  });

  // 빈 문서 대비 '새 멘션' 전체를 알림(수정과 동일 규칙, B5).
  const recipients = await newMentionRecipients(
    { type: "doc", content: [{ type: "paragraph" }] } as JSONContent,
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
        entityId: announcement.id,
        context: announcement.title,
      })),
    });
  }

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
  // 서버 액션 경계 방어: doc 형태·크기만 검증(비정상 페이로드가 본문을 비우는 것 방지).
  if (!isRichDoc(content)) throw new Error("본문 형식이 올바르지 않습니다");
  const current = await prisma.announcement.findUnique({ where: { id } });
  if (!current) throw new Error("공지를 찾을 수 없습니다");

  const nextTitle = title.trim() || "제목 없음";
  const unchanged =
    current.title === nextTitle &&
    JSON.stringify(current.content) === JSON.stringify(content);
  if (unchanged) return { id };

  // 본문에 '새로 추가된' 멘션(사람 + 팀 확장)에 알림. 위키와 동일 규칙(B5).
  // 알림 생성이 실패하면 재시도가 unchanged 분기로 빠져 알림만 누락되므로,
  // 수정과 알림 생성을 한 트랜잭션으로 묶는다.
  const recipients = await newMentionRecipients(
    current.content as JSONContent,
    content,
    user.id,
  );
  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.announcement.update({
      where: { id },
      data: {
        title: nextTitle,
        content: content as Prisma.InputJsonValue,
      },
    }),
  ];
  if (recipients.length > 0) {
    writes.push(
      prisma.notification.createMany({
        data: recipients.map((uid) => ({
          userId: uid,
          actorId: user.id,
          type: "mention",
          entityType: "announcement",
          entityId: id,
          context: nextTitle,
        })),
      }),
    );
  }
  await prisma.$transaction(writes);

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
