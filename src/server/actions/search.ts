"use server";

import { requireUser } from "@/lib/session";
import { globalSearch, type GlobalSearchResult } from "@/server/queries";
import { cached } from "@/lib/server-cache";

// 검색 결과는 read-your-own-writes 가 필요 없는 조회 전용 경로라 짧은 TTL 캐시로
// 타이핑 중 반복 조회를 줄인다(pod 로컬, TTL 로만 만료 — lib/server-cache 주석 참조).
const SEARCH_TTL_MS = 15_000;

/**
 * 커맨드 팔레트(⌘K)용 전역 검색 서버 액션(C7). 로그인 필수, plain JSON 반환.
 * 실제 조회는 queries.globalSearch 가 담당(액션은 인증 래퍼 + TTL 캐시).
 */
export async function globalSearchAction(
  q: string,
): Promise<GlobalSearchResult> {
  await requireUser();
  const key = `globalSearch:${q.trim().toLowerCase()}`;
  return cached(key, SEARCH_TTL_MS, () => globalSearch(q));
}
