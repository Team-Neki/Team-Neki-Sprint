"use server";

import { requireUser } from "@/lib/session";
import { globalSearch, type GlobalSearchResult } from "@/server/queries";

/**
 * 커맨드 팔레트(⌘K)용 전역 검색 서버 액션(C7). 로그인 필수, plain JSON 반환.
 * 실제 조회는 queries.globalSearch 가 담당(액션은 인증 래퍼).
 */
export async function globalSearchAction(
  q: string,
): Promise<GlobalSearchResult> {
  await requireUser();
  return globalSearch(q);
}
