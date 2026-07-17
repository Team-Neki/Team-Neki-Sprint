import { describe, expect, it } from "vitest";
import {
  folderKey,
  pageKey,
  parseCollapsed,
  serializeCollapsed,
} from "@/components/wiki/wiki-collapsed";

describe("접힘 key 네임스페이스", () => {
  it("폴더와 페이지 key 는 접두어로 구분된다(id 충돌 방지)", () => {
    expect(folderKey("abc")).toBe("f:abc");
    expect(pageKey("abc")).toBe("p:abc");
    expect(folderKey("abc")).not.toBe(pageKey("abc"));
  });
});

describe("parseCollapsed", () => {
  it("null/빈 문자열은 빈 Set", () => {
    expect(parseCollapsed(null).size).toBe(0);
    expect(parseCollapsed("").size).toBe(0);
  });

  it("깨진 JSON 은 빈 Set", () => {
    expect(parseCollapsed("{not json").size).toBe(0);
  });

  it("배열이 아니면 빈 Set", () => {
    expect(parseCollapsed('{"a":1}').size).toBe(0);
    expect(parseCollapsed('"f:1"').size).toBe(0);
  });

  it("문자열 배열을 Set 으로, 비-문자열은 걸러낸다", () => {
    const set = parseCollapsed('["f:1","p:2",3,null,"f:3"]');
    expect([...set].sort()).toEqual(["f:1", "f:3", "p:2"]);
  });
});

describe("serializeCollapsed <-> parseCollapsed 라운드트립", () => {
  it("Set 을 직렬화 후 다시 파싱하면 동일 원소", () => {
    const original = new Set([folderKey("1"), pageKey("2"), folderKey("3")]);
    const round = parseCollapsed(serializeCollapsed(original));
    expect([...round].sort()).toEqual([...original].sort());
  });

  it("빈 Set 은 빈 배열 JSON", () => {
    expect(serializeCollapsed(new Set())).toBe("[]");
  });
});
