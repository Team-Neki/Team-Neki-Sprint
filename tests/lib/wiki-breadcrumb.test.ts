import { describe, expect, it } from "vitest";
import { buildWikiBreadcrumb } from "@/lib/wiki-breadcrumb";

const folders = [
  { id: "F1", name: "폴더1", parentId: null },
  { id: "F2", name: "폴더2", parentId: "F1" },
];

const pages = [
  { id: "P1", title: "루트", parentId: null, folderId: "F2" },
  { id: "P2", title: "자식", parentId: "P1", folderId: null },
  { id: "P3", title: "손자", parentId: "P2", folderId: null },
  { id: "T0", title: "최상위", parentId: null, folderId: null },
];

const labels = (pageId: string) =>
  buildWikiBreadcrumb(pageId, pages, folders).map((c) => c.label);

describe("buildWikiBreadcrumb", () => {
  it("폴더도 부모 페이지도 없으면 빈 배열", () => {
    expect(buildWikiBreadcrumb("T0", pages, folders)).toEqual([]);
  });

  it("폴더 안 최상위 페이지는 폴더 체인만(현재 페이지 제외)", () => {
    expect(labels("P1")).toEqual(["폴더1", "폴더2"]);
  });

  it("중첩 페이지는 폴더 + 조상 페이지 순(root→parent)", () => {
    expect(labels("P3")).toEqual(["폴더1", "폴더2", "루트", "자식"]);
  });

  it("폴더는 href 없음, 조상 페이지는 /wiki/<id> 링크", () => {
    const crumbs = buildWikiBreadcrumb("P3", pages, folders);
    expect(crumbs.find((c) => c.label === "폴더2")?.href).toBeUndefined();
    expect(crumbs.find((c) => c.label === "루트")?.href).toBe("/wiki/P1");
  });

  it("존재하지 않는 페이지는 빈 배열", () => {
    expect(buildWikiBreadcrumb("없음", pages, folders)).toEqual([]);
  });

  it("부모 순환이 있어도 무한 루프 없이 종료", () => {
    const cyclic = [
      { id: "A", title: "A", parentId: "B", folderId: null },
      { id: "B", title: "B", parentId: "A", folderId: null },
    ];
    expect(() => buildWikiBreadcrumb("A", cyclic, [])).not.toThrow();
  });
});
