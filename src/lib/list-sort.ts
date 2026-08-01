/**
 * 목록 페이지의 URL 정렬 파라미터(`?sort=<field>&dir=asc|desc`) 파싱 공용 헬퍼.
 * 표 헤더(`SortableHead`)가 만드는 쿼리를 서버 컴포넌트에서 해석할 때 쓴다.
 *
 * 화이트리스트(`allowed`)에 없는 field 는 무시하고 undefined 를 돌려준다 —
 * 정렬 지정 없음 = 각 쿼리의 기본 정렬(order.ts) 유지. 임의 문자열이 그대로
 * prisma orderBy 키로 넘어가지 않게 하는 방어선이기도 하다.
 */
export type SortDir = "asc" | "desc";

export type ListSort<F extends string> = { field: F; dir: SortDir };

export function parseListSort<F extends string>(
  params: { sort?: string; dir?: string },
  allowed: readonly F[],
): ListSort<F> | undefined {
  const field = allowed.find((f) => f === params.sort);
  if (!field) return undefined;
  // dir 은 asc 만 명시적으로 받고 나머지(없음·오타 포함)는 desc — SortableHead 의
  // 3단 토글(미정렬 → desc → asc → 미정렬)과 같은 기본값.
  return { field, dir: params.dir === "asc" ? "asc" : "desc" };
}
