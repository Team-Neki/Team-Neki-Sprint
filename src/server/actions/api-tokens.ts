"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { buildToken } from "@/lib/api-token";

const nameSchema = z
  .string()
  .trim()
  .min(1, { error: "이름을 입력하세요" })
  .max(60);

/** 현재 유저의 토큰 발급. 원문은 이 응답에서만 반환하고 저장하지 않는다. */
export async function createApiToken(name: string) {
  const user = await requireUser();
  const parsed = nameSchema.parse(name);
  const { raw, hash, prefix } = buildToken();
  await prisma.apiToken.create({
    data: { userId: user.id, name: parsed, tokenHash: hash, prefix },
  });
  // 토큰 UI는 본인 프로필 페이지에 있다.
  revalidatePath(`/users/${user.id}`);
  return { raw };
}

/** 현재 유저의 토큰 폐기(soft). 본인 토큰만 대상. */
export async function revokeApiToken(id: string) {
  const user = await requireUser();
  await prisma.apiToken.updateMany({
    where: { id, userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidatePath(`/users/${user.id}`);
}

/**
 * 토큰 재발급(rotate): 기존 토큰을 폐기하고 같은 이름으로 새 토큰을 발급한다.
 * 새 원문은 이 응답에서만 반환한다. 본인 소유의 활성 토큰만 대상.
 */
export async function rotateApiToken(id: string) {
  const user = await requireUser();
  const { raw, hash, prefix } = buildToken();
  const rotated = await prisma.$transaction(async (tx) => {
    const existing = await tx.apiToken.findFirst({
      where: { id, userId: user.id, revokedAt: null },
      select: { name: true },
    });
    if (!existing) return null;
    await tx.apiToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    await tx.apiToken.create({
      data: { userId: user.id, name: existing.name, tokenHash: hash, prefix },
    });
    return { raw };
  });
  if (!rotated) throw new Error("토큰을 찾을 수 없습니다");
  revalidatePath(`/users/${user.id}`);
  return rotated;
}
