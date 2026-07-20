"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/**
 * 컬럼 커스터마이즈(F4) 대상 PLP 표. 이 집합 밖 table 은 거부한다.
 * key = table 식별자, value = revalidate 할 목록 경로.
 */
const TABLE_PATHS = {
  tasks: "/tasks",
  epics: "/epics",
  projects: "/projects",
  sprints: "/sprints",
} as const;

const tableSchema = z.enum(
  Object.keys(TABLE_PATHS) as [keyof typeof TABLE_PATHS],
);

const columnsSchema = z.array(
  z.object({ key: z.string().min(1).max(64), visible: z.boolean() }),
);

/**
 * 유저별 표 컬럼 순서·노출 저장(F4). 로그인 사용자 본인 설정만 다룬다.
 * columns 비면 행을 삭제해 기본 컬럼으로 폴백(getColumnPref → null). 그 외엔 upsert.
 */
export async function saveColumnPref(table: string, columns: unknown) {
  const user = await requireUser();
  const t = tableSchema.parse(table);
  const cols = columnsSchema.parse(columns);

  if (cols.length === 0) {
    // 비어 있으면(= "기본값으로") 행 삭제 → 폴백. 없어도 조용히 통과(멱등).
    await prisma.userColumnPref.deleteMany({
      where: { userId: user.id, table: t },
    });
  } else {
    await prisma.userColumnPref.upsert({
      where: { userId_table: { userId: user.id, table: t } },
      create: { userId: user.id, table: t, columns: cols },
      update: { columns: cols },
    });
  }

  revalidatePath(TABLE_PATHS[t]);
  return { table: t };
}
