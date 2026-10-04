import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type EntityType = "sprint" | "project" | "team" | "epic" | "task" | "wiki";

/** 한 필드의 before→after 변경(업무 히스토리 meta 로 저장). */
export type FieldChange = { field: string; from: unknown; to: unknown };

/** meta·비교용으로 값을 정규화한다(Date→ISO, undefined→null). */
function normalizeValue(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  return v ?? null;
}

/**
 * 현재 엔티티 값(current)과 검증된 patch 를 비교해 **바뀐 필드만** 골라낸다.
 * - `changes`: 필드별 정규화된 from/to (Activity meta 로 그대로 기록)
 * - `data`: prisma update 에 넘길, 실제로 바뀐 필드만 담은 객체(원본 타입 유지)
 * patch 의 undefined 키(미제공)는 무시한다 — 단일 필드 인라인 편집 안전.
 */
export function diffFields(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): { changes: FieldChange[]; data: Record<string, unknown> } {
  const changes: FieldChange[] = [];
  const data: Record<string, unknown> = {};
  for (const [field, rawTo] of Object.entries(patch)) {
    if (rawTo === undefined) continue;
    const from = normalizeValue(current[field]);
    const to = normalizeValue(rawTo);
    if (from === to) continue;
    changes.push({ field, from, to });
    data[field] = rawTo;
  }
  return { changes, data };
}

/**
 * Fire-and-forget activity log. Never throws into the caller's flow.
 * tx 를 주면 그 트랜잭션에 묶고 실패를 던진다 — 트랜잭션 안에서 삼키면 Postgres 트랜잭션이
 * 중단된 채 커밋 시점에 조용히 롤백되어 본 변경까지 사라질 수 있다.
 */
export async function logActivity(
  params: {
    userId?: string | null;
    entityType: EntityType;
    entityId: string;
    action: string;
    meta?: Record<string, unknown>;
  },
  tx?: Prisma.TransactionClient,
) {
  try {
    await (tx ?? prisma).activity.create({
      data: {
        userId: params.userId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        meta: params.meta ? (params.meta as object) : undefined,
      },
    });
  } catch (e) {
    if (tx) throw e;
    // logging must not break the mutation
  }
}
