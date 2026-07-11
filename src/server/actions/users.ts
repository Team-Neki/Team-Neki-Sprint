"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { profileSchema } from "@/lib/validators";

/**
 * 본인 프로필(내 정보) 수정. 세션 사용자 자신만 편집 가능(id 는 세션에서 취함).
 * 팀·역할·이메일은 자기수정 대상이 아니라 제외 — 이름/연락처만 갱신한다.
 */
export async function updateProfile(input: unknown) {
  const user = await requireUser();
  const data = profileSchema.parse(input);

  await prisma.user.update({ where: { id: user.id }, data });

  // 프로필 상세 + 멤버 목록 갱신. 헤더 이름/아바타는 DB 세션 기반이라
  // 클라이언트의 router.refresh() 로 레이아웃이 재실행되며 반영된다.
  revalidatePath(`/users/${user.id}`);
  revalidatePath("/users");
  return { id: user.id };
}

/**
 * 사용자 미리보기(팀 페이지 등에서 이름/아바타 클릭 시 중앙 팝업으로 표시). 상세 페이지의
 * 무거운 목록 대신 요약 정보 + 담당/오너 개수만 조회한다.
 */
export async function getUserPreview(id: string) {
  await requireUser();
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phone: true,
      role: true,
      team: { select: { key: true, name: true, color: true } },
      _count: { select: { assignedTasks: true, ownedEpics: true } },
    },
  });
}
