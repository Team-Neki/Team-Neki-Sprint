"use client";

import { usePathname, useRouter } from "next/navigation";

/**
 * 목록 필터의 URL 파라미터 갱신 공용 훅. 넘긴 키만 바꾸고(빈 문자열이면 키 삭제)
 * 나머지(다른 필터·sort·dir)는 그대로 둔 채 router.replace 한다.
 *
 * 현재 쿼리는 렌더 시점 searchParams 가 아니라 호출 시점 window.location 에서 읽는다 —
 * 디바운스된 검색어 갱신이 그 사이 바뀐 다른 필터를 옛 값으로 덮지 않게.
 */
export function useSetSearchParams() {
  const router = useRouter();
  const pathname = usePathname();
  return (updates: Record<string, string>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };
}
