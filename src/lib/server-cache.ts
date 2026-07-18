/**
 * 서버 인메모리 TTL 캐시.
 *
 * 반드시 "짧은 staleness 를 허용할 수 있는 읽기 전용 경로"에만 쓴다.
 * prod 는 replicas: 2 로 pod 별 캐시가 따로 돌기 때문에(gotchas §13),
 * 무효화(invalidate)는 같은 pod 안에서만 유효한 best-effort 최적화다.
 * 다른 pod 는 TTL 만료로만 갱신된다 — 즉 **정합성이 TTL 로만 보장되는 곳**
 * (검색/멘션 자동완성 등)에 한정하고, read-your-own-writes 가 필요한 목록·트리
 * (위키 사이드바 등)에는 절대 쓰지 않는다.
 *
 * dev(HMR)에서 모듈이 재로드돼도 캐시가 유지되도록 globalThis 에 저장한다
 * (lib/prisma.ts 의 싱글턴 패턴과 동일한 이유).
 */

type Entry = { value: unknown; expiresAt: number };

type CacheStore = {
  entries: Map<string, Entry>;
  // 동일 키 동시 호출 시 로더 중복 실행 방지(dogpile 방지).
  inflight: Map<string, Promise<unknown>>;
};

const globalStash = globalThis as unknown as { __serverCache?: CacheStore };

const store: CacheStore = (globalStash.__serverCache ??= {
  entries: new Map(),
  inflight: new Map(),
});

/** 키 수 상한. 초과 시 가장 오래 전에 저장된 항목부터 제거(간단 FIFO). */
const MAX_ENTRIES = 500;

function evictIfNeeded() {
  while (store.entries.size > MAX_ENTRIES) {
    const oldest = store.entries.keys().next().value;
    if (oldest === undefined) return;
    store.entries.delete(oldest);
  }
}

/** 만료 전 값이 있으면 반환, 없으면 undefined. */
export function cacheGet<T>(key: string): T | undefined {
  const entry = store.entries.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.entries.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  if (ttlMs <= 0) return;
  // 재저장 시 삽입 순서를 갱신해 FIFO 퇴출이 최근 키를 먼저 지우지 않게 한다.
  store.entries.delete(key);
  store.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  evictIfNeeded();
}

/** 특정 키(정확 일치) 무효화. 같은 pod 안에서만 유효(파일 상단 주석 참조). */
export function cacheDelete(key: string): void {
  store.entries.delete(key);
}

/** prefix 로 시작하는 모든 키 무효화(예: 검색 캐시 전체). prefix 생략 시 전체 비움. */
export function cacheClear(prefix?: string): void {
  if (prefix === undefined) {
    store.entries.clear();
    return;
  }
  for (const key of store.entries.keys()) {
    if (key.startsWith(prefix)) store.entries.delete(key);
  }
}

/**
 * 캐시 조회 → 미스면 loader 실행 후 저장. 동시 미스는 in-flight promise 를
 * 공유해 로더를 한 번만 실행한다. loader 가 throw 하면 캐시에 남기지 않는다.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;

  const pending = store.inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    try {
      const value = await loader();
      // undefined 는 미스와 구분이 안 되므로 캐시하지 않는다(null 은 캐시됨).
      if (value !== undefined) cacheSet(key, value, ttlMs);
      return value;
    } finally {
      store.inflight.delete(key);
    }
  })();
  store.inflight.set(key, promise);
  return promise;
}
