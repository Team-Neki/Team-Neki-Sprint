// 위키 사이드바 폴더/페이지 접힘 상태의 순수 헬퍼(key 네임스페이스 + 직렬화). localStorage
// I/O·React state 는 page-tree.tsx 가 담당하고, 여기엔 순수 로직만 둬 단위 테스트가 가능하다.

/** 폴더/페이지 id 충돌 방지용 접힘 key 네임스페이스. */
export const folderKey = (id: string) => `f:${id}`;
export const pageKey = (id: string) => `p:${id}`;

/** localStorage 원문(JSON 문자열 배열)을 접힘 Set 으로 파싱. null/깨진 값은 빈 Set. */
export function parseCollapsed(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const arr: unknown = JSON.parse(raw);
    return Array.isArray(arr)
      ? new Set(arr.filter((v): v is string => typeof v === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

/** 접힘 Set 을 localStorage 저장용 JSON 문자열(배열)로 직렬화. */
export function serializeCollapsed(set: Set<string>): string {
  return JSON.stringify([...set]);
}
