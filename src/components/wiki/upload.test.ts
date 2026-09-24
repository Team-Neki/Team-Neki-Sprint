import { describe, expect, it } from "vitest";
import { splitFiles } from "./upload";

function f(name: string, type: string) {
  return { name, type } as File;
}

describe("splitFiles", () => {
  it("이미지와 그 외 파일을 나눈다(SVG 는 첨부 쪽)", () => {
    const { images, others } = splitFiles([
      f("a.png", "image/png"),
      f("b.pdf", "application/pdf"),
      f("c.svg", "image/svg+xml"),
    ]);
    expect(images.map((x) => x.name)).toEqual(["a.png"]);
    expect(others.map((x) => x.name)).toEqual(["b.pdf", "c.svg"]);
  });

  it("빈 입력", () => {
    expect(splitFiles(null)).toEqual({ images: [], others: [] });
    expect(splitFiles(undefined)).toEqual({ images: [], others: [] });
  });
});
