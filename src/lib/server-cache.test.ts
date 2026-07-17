import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  cached,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheClear,
} from "@/lib/server-cache";

describe("server-cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cacheClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("set 후 TTL 이내엔 get 히트, 만료 후엔 미스", () => {
    cacheSet("k", "v", 1000);
    expect(cacheGet("k")).toBe("v");
    vi.advanceTimersByTime(999);
    expect(cacheGet("k")).toBe("v");
    vi.advanceTimersByTime(2);
    expect(cacheGet("k")).toBeUndefined();
  });

  it("ttl<=0 은 저장하지 않는다", () => {
    cacheSet("k", "v", 0);
    expect(cacheGet("k")).toBeUndefined();
  });

  it("cacheDelete 는 해당 키만, cacheClear(prefix) 는 prefix 만 지운다", () => {
    cacheSet("a:1", 1, 1000);
    cacheSet("a:2", 2, 1000);
    cacheSet("b:1", 3, 1000);
    cacheDelete("a:1");
    expect(cacheGet("a:1")).toBeUndefined();
    expect(cacheGet("a:2")).toBe(2);
    cacheClear("a:");
    expect(cacheGet("a:2")).toBeUndefined();
    expect(cacheGet("b:1")).toBe(3);
  });

  it("cached: 미스면 loader 실행·저장, 히트면 loader 미실행", async () => {
    const loader = vi.fn().mockResolvedValue("value");
    expect(await cached("k", 1000, loader)).toBe("value");
    expect(await cached("k", 1000, loader)).toBe("value");
    expect(loader).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1001);
    expect(await cached("k", 1000, loader)).toBe("value");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("cached: 동시 미스는 in-flight 를 공유해 loader 를 한 번만 실행", async () => {
    let resolve!: (v: string) => void;
    const loader = vi.fn(
      () => new Promise<string>((r) => (resolve = r)),
    );
    const p1 = cached("k", 1000, loader);
    const p2 = cached("k", 1000, loader);
    resolve("once");
    expect(await p1).toBe("once");
    expect(await p2).toBe("once");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("cached: loader 가 throw 하면 캐시에 남지 않고 다음 호출이 재시도", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");
    await expect(cached("k", 1000, loader)).rejects.toThrow("boom");
    expect(await cached("k", 1000, loader)).toBe("ok");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("null 값도 캐시된다(미스와 구분)", async () => {
    const loader = vi.fn().mockResolvedValue(null);
    expect(await cached("k", 1000, loader)).toBeNull();
    expect(await cached("k", 1000, loader)).toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
