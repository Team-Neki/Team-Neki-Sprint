import { describe, it, expect } from "vitest";
import { parseTaskKeyFromRef } from "@/lib/github/parse-key";

describe("parseTaskKeyFromRef", () => {
  const keys = ["DESIGN", "API"];
  it("브랜치명에서 KEY-NUMBER 추출", () => {
    expect(parseTaskKeyFromRef("feature/DESIGN-12-login", keys)).toEqual({
      teamKey: "DESIGN",
      number: 12,
    });
  });
  it("대소문자 무시하고 팀 키 대조, 반환은 대문자", () => {
    expect(parseTaskKeyFromRef("fix/design-7", keys)).toEqual({
      teamKey: "DESIGN",
      number: 7,
    });
  });
  it("알 수 없는 접두어는 무시하고 다음 매칭", () => {
    expect(parseTaskKeyFromRef("feature/FOO-1-and-API-9", keys)).toEqual({
      teamKey: "API",
      number: 9,
    });
  });
  it("매칭 없으면 null", () => {
    expect(parseTaskKeyFromRef("hotfix/urgent", keys)).toBeNull();
  });
});
