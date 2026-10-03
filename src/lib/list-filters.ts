/**
 * 목록 페이지의 다중선택 필터 파라미터(F6, 콤마구분 `?status=TODO,DONE`) 파싱 공용 헬퍼.
 * `parseListSort` 의 필터판 — 서버 컴포넌트에서 searchParams 를 쿼리 인자로 바꾼다.
 *
 * spec 의 값이 배열이면 enum 화이트리스트(예: STATUS_ORDER)로 보고 거기 없는 값은
 * 버린다 — `?status=foo` 가 prisma enum 에러(에러 페이지)로 새지 않게 하는 방어선.
 * null 이면 id 같은 자유값이라 그대로 둔다.
 *
 * hasFilter 는 파싱 후 남은 값 기준이다(무효값만 있으면 필터 없음과 같다).
 */
type FilterSpec = Record<string, readonly string[] | null>;

export type ListFilters<S extends FilterSpec> = {
  [K in keyof S]: S[K] extends readonly (infer V)[] ? V[] : string[];
} & { hasFilter: boolean };

export function parseListFilters<S extends FilterSpec>(
  params: { [K in keyof S]?: string },
  spec: S,
): ListFilters<S> {
  const out: Record<string, string[]> = {};
  for (const [key, allowed] of Object.entries(spec)) {
    const values = ((params as Record<string, string | undefined>)[key] ?? "")
      .split(",")
      .filter(Boolean);
    out[key] = allowed ? values.filter((v) => allowed.includes(v)) : values;
  }
  const hasFilter = Object.values(out).some((v) => v.length > 0);
  return { ...out, hasFilter } as ListFilters<S>;
}
