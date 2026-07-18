import { describe, it, expect } from "vitest";
import { markdownToDoc } from "./text-to-doc";

describe("markdownToDoc", () => {
  it("wraps a plain paragraph", () => {
    expect(markdownToDoc("hello world")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hello world" }] },
      ],
    });
  });

  it("parses headings by leading hashes", () => {
    const doc = markdownToDoc("# Title\n\nbody");
    expect(doc.content?.[0]).toEqual({
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Title" }],
    });
    expect(doc.content?.[1].type).toBe("paragraph");
  });

  it("parses a bullet list block", () => {
    const doc = markdownToDoc("- a\n- b");
    expect(doc.content?.[0].type).toBe("bulletList");
    expect(doc.content?.[0].content).toHaveLength(2);
    expect(doc.content?.[0].content?.[0]).toEqual({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }],
    });
  });

  it("parses a fenced code block preserving text and language", () => {
    const doc = markdownToDoc("```ts\nconst a = 1\n```");
    expect(doc.content?.[0]).toEqual({
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const a = 1" }],
    });
  });

  it("parses bold, italic, code, and links inline", () => {
    const doc = markdownToDoc("a **b** _c_ `d` [e](https://x.io)");
    const marks = doc.content?.[0].content;
    expect(marks).toEqual([
      { type: "text", text: "a " },
      { type: "text", text: "b", marks: [{ type: "bold" }] },
      { type: "text", text: " " },
      { type: "text", text: "c", marks: [{ type: "italic" }] },
      { type: "text", text: " " },
      { type: "text", text: "d", marks: [{ type: "code" }] },
      { type: "text", text: " " },
      {
        type: "text",
        text: "e",
        marks: [{ type: "link", attrs: { href: "https://x.io" } }],
      },
    ]);
  });

  it("returns an empty paragraph for empty input", () => {
    expect(markdownToDoc("")).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});
