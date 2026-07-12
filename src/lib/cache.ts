import { updateTag } from "next/cache";

/**
 * 데이터 레이어 캐시(D3) 태그. 공유(비유저 종속) 목록/옵션/트리 쿼리를
 * `unstable_cache` 로 감쌀 때 부여하고, mutating 액션에서 `bumpTags` 로 무효화한다.
 *
 * 페이지는 `requireUser`(쿠키)로 어차피 동적(force-dynamic)이라 라우트 캐시는
 * 그대로 두고, 여기서는 DB 조회 결과만 요청 간 공유해 부하를 줄인다.
 * (유저별/검색/상세 쿼리는 캐시 대상 아님 — 정합성 리스크·저가치.)
 */
export const CACHE_TAGS = {
  teams: "teams",
  sprints: "sprints",
  projects: "projects",
  epics: "epics",
  tasks: "tasks",
  labels: "labels",
  wiki: "wiki",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * 캐시 백스톱(초). 태그 무효화를 촘촘히 걸어두지만, 교차 엔티티 표시 의존성
 * (예: 팀 key 변경이 태스크 목록에 반영)을 한 곳이라도 놓쳤을 때 staleness 를
 * 이 창(window) 이내로 제한한다. 옵션은 거의 안 변하므로 더 길게 둔다.
 */
export const CACHE_REVALIDATE = {
  list: 60,
  wiki: 120,
  options: 300,
} as const;

/**
 * 액션에서 변경 후 관련 태그를 한 번에 무효화한다(중복 태그는 무해).
 *
 * Next 16 에선 read-your-own-writes(방금 만든/바꾼 걸 바로 보기)에 `updateTag` 를
 * 쓴다. `revalidateTag` 는 `{ expire: 0 }` 을 줘도 태그를 stale 로만 표시해
 * stale-while-revalidate(옛 값 먼저 서빙, 뒤에서 갱신)로 동작 → mutation 직후
 * router.refresh() 가 옛 데이터를 받아 "한 번 더 요청해야 반영되는" off-by-one
 * staleness 가 생긴다. `updateTag` 는 태그를 즉시 만료시켜 다음 요청이 최신 값을
 * 기다리게 하므로 이 문제가 없다. 단 Server Action 안에서만 호출 가능(이 헬퍼의
 * 호출부는 모두 "use server" 액션).
 */
export function bumpTags(...tags: CacheTag[]): void {
  for (const tag of tags) updateTag(tag);
}
