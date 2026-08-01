import { describe, expect, it } from "vitest";
import {
  SLASH_COMMANDS,
  filterByQuery,
  type SlashCommandMeta,
} from "@/components/wiki/slash-commands";

const keysOf = (items: SlashCommandMeta[]) => items.map((i) => i.key);

describe("SLASH_COMMANDS 메타", () => {
  it("key 는 고유하고 title·subtitle·aliases 가 비어있지 않다", () => {
    const keys = keysOf(SLASH_COMMANDS);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of SLASH_COMMANDS) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.subtitle.length).toBeGreaterThan(0);
      expect(c.aliases.length).toBeGreaterThan(0);
    }
  });

  it("요청된 핵심 커맨드(code·table·mermaid·h1~h6·divider)를 포함한다", () => {
    const keys = new Set(keysOf(SLASH_COMMANDS));
    for (const k of [
      "code",
      "table",
      "mermaid",
      "divider",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
    ]) {
      expect(keys.has(k)).toBe(true);
    }
  });
});

describe("filterByQuery", () => {
  it("빈/공백 query 는 전체를 반환한다", () => {
    expect(filterByQuery(SLASH_COMMANDS, "")).toHaveLength(
      SLASH_COMMANDS.length,
    );
    expect(filterByQuery(SLASH_COMMANDS, "   ")).toHaveLength(
      SLASH_COMMANDS.length,
    );
  });

  it("영문 별칭으로 매칭한다(code·table·mermaid)", () => {
    expect(keysOf(filterByQuery(SLASH_COMMANDS, "code"))).toContain("code");
    expect(keysOf(filterByQuery(SLASH_COMMANDS, "table"))).toContain("table");
    expect(keysOf(filterByQuery(SLASH_COMMANDS, "mermaid"))).toContain(
      "mermaid",
    );
  });

  it("한글 별칭/제목으로 매칭한다(표·구분선)", () => {
    expect(keysOf(filterByQuery(SLASH_COMMANDS, "표"))).toContain("table");
    expect(keysOf(filterByQuery(SLASH_COMMANDS, "구분선"))).toContain(
      "divider",
    );
  });

  it("'제목' 은 h1~h6 를 모두 매칭한다", () => {
    const keys = keysOf(filterByQuery(SLASH_COMMANDS, "제목"));
    for (const k of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      expect(keys).toContain(k);
    }
  });

  it("'h3' 은 제목 3 만 매칭한다", () => {
    expect(keysOf(filterByQuery(SLASH_COMMANDS, "h3"))).toEqual(["h3"]);
  });

  it("대소문자·앞뒤 공백을 무시한다", () => {
    expect(keysOf(filterByQuery(SLASH_COMMANDS, "TABLE"))).toContain("table");
    expect(keysOf(filterByQuery(SLASH_COMMANDS, "  code  "))).toContain("code");
  });

  it("일치하는 게 없으면 빈 배열", () => {
    expect(filterByQuery(SLASH_COMMANDS, "zzz-없음")).toEqual([]);
  });
});
