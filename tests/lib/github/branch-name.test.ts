import { describe, it, expect } from "vitest";
import { slugify, buildBranchName } from "@/lib/github/branch-name";

describe("slugify", () => {
  it("영문 제목을 소문자 하이픈 slug 로", () => {
    expect(slugify("Login Button")).toBe("login-button");
  });
  it("특수문자/연속 공백을 하이픈 하나로 축약하고 양끝 하이픈 제거", () => {
    expect(slugify("  Fix: the (broken) thing!! ")).toBe("fix-the-broken-thing");
  });
  it("비ASCII(한글)만이면 빈 문자열", () => {
    expect(slugify("로그인 버튼")).toBe("");
  });
  it("40자로 자른다", () => {
    expect(slugify("a".repeat(60)).length).toBe(40);
  });
});

describe("buildBranchName", () => {
  it("prefix/KEY-slug 형태", () => {
    expect(buildBranchName("feature", "DESIGN-12", "Login Button")).toBe(
      "feature/DESIGN-12-login-button",
    );
  });
  it("slug 가 비면 prefix/KEY 로 폴백", () => {
    expect(buildBranchName("fix", "API-3", "로그인")).toBe("fix/API-3");
  });
});
