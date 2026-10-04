import { describe, it, expect } from "vitest";
import { Node, Schema } from "@tiptap/pm/model";
import type { JSONContent } from "@tiptap/core";
import { markdownToDoc } from "./text-to-doc";

// 위키 에디터(wikiExtensions)와 같은 노드 이름·내용 규칙만 옮긴 축소 스키마.
// 변환 결과가 실제로 열리는 구조인지(check) 확인하는 용도.
const wikiLike = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    heading: { group: "block", content: "inline*", attrs: { level: { default: 1 } } },
    blockquote: { group: "block", content: "block+" },
    horizontalRule: { group: "block" },
    codeBlock: { group: "block", content: "text*", attrs: { language: { default: null } } },
    mermaidBlock: { group: "block", atom: true, attrs: { code: { default: "" } } },
    bulletList: { group: "block", content: "listItem+" },
    orderedList: { group: "block", content: "listItem+" },
    listItem: { content: "paragraph block*" },
    taskList: { group: "block", content: "taskItem+" },
    taskItem: { content: "paragraph block*", attrs: { checked: { default: false } } },
    table: { group: "block", content: "tableRow+" },
    tableRow: { content: "(tableCell | tableHeader)*" },
    tableCell: { content: "block+" },
    tableHeader: { content: "block+" },
    text: { group: "inline" },
  },
  marks: {
    bold: {},
    italic: {},
    code: {},
    link: { attrs: { href: {} } },
  },
});

const blocks = (md: string) => markdownToDoc(md).content ?? [];
const text = (n: JSONContent): string =>
  n.type === "text" ? (n.text ?? "") : (n.content ?? []).map(text).join("");

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

  it("파이프 표를 표 노드로(헤더 행 + 본문 행, 모자란 칸은 빈 칸)", () => {
    const [table] = blocks("| 이름 | 역할 |\n|---|:---:|\n| koo | backend |\n| ann |");
    expect(table.type).toBe("table");
    const rows = table.content!;
    expect(rows.map((r) => r.content!.map((c) => c.type))).toEqual([
      ["tableHeader", "tableHeader"],
      ["tableCell", "tableCell"],
      ["tableCell", "tableCell"],
    ]);
    expect(rows.map((r) => r.content!.map(text))).toEqual([
      ["이름", "역할"],
      ["koo", "backend"],
      ["ann", ""],
    ]);
  });

  it("표 칸 안의 \\| 는 구분자가 아니라 글자", () => {
    const [table] = blocks("| a | b |\n| --- | --- |\n| x \\| y | z |");
    expect(table.content![1].content!.map(text)).toEqual(["x | y", "z"]);
  });

  it("mermaid 펜스는 다이어그램 블록으로", () => {
    expect(blocks("```mermaid\nflowchart TD\n  A --> B\n```")).toEqual([
      { type: "mermaidBlock", attrs: { code: "flowchart TD\n  A --> B" } },
    ]);
  });

  it("인용·구분선·체크리스트", () => {
    const out = blocks("> 주의\n> 두 줄\n\n---\n\n- [ ] 할 일\n- [x] 끝난 일");
    expect(out.map((n) => n.type)).toEqual(["blockquote", "horizontalRule", "taskList"]);
    expect(text(out[0])).toBe("주의 두 줄");
    expect(out[2].content!.map((i) => [i.attrs?.checked, text(i)])).toEqual([
      [false, "할 일"],
      [true, "끝난 일"],
    ]);
  });

  it("들여쓴 하위 목록은 상위 항목 안에 중첩", () => {
    const [list] = blocks("- 상위\n  - 하위 1\n  - 하위 2\n    1. 손자\n- 다음");
    expect(list.type).toBe("bulletList");
    const [first, second] = list.content!;
    expect(first.content!.map((n) => n.type)).toEqual(["paragraph", "bulletList"]);
    const sub = first.content![1];
    expect(sub.content!.map((i) => text(i.content![0]))).toEqual(["하위 1", "하위 2"]);
    expect(sub.content![1].content![1].type).toBe("orderedList");
    expect(text(second)).toBe("다음");
  });

  it("글머리 목록 바로 뒤의 체크 항목은 별도 체크리스트로 나눈다", () => {
    const out = blocks("- 일반 항목\n- [ ] 할 일\n- [x] 끝난 일\n- 다시 일반");
    expect(out.map((n) => n.type)).toEqual(["bulletList", "taskList", "bulletList"]);
    expect(out[1].content!.map(text)).toEqual(["할 일", "끝난 일"]);
  });

  // 회귀 방지: AI 가 쓰는 전형적인 설계 문서를 통째로 변환해, 블록 문법이 글자로 남은
  // 문단(깨져 보이는 표·목록·인용·펜스)이 없고 에디터 구조로 열리는지 본다.
  it("AI 작성 문서에서 블록 문법이 글자로 남지 않는다", () => {
    const md = [
      "# 검색 아키텍처",
      "",
      "> 이 문서는 검색 파이프라인을 다룹니다.",
      "",
      "## 단계",
      "",
      "| 단계 | 하는 일 | 실행 주체 |",
      "|---|---|---|",
      "| collect | 브랜드 사이트 수집 | Prefect |",
      "| index | **검색 카드** 가공 | Spring Batch |",
      "",
      "```mermaid",
      "flowchart LR",
      "  collect --> enrich --> index",
      "```",
      "",
      "1. 수집",
      "   - 브랜드 11곳",
      "   - [Kakao](https://kakao.com) 좌표",
      "2. 색인",
      "",
      "- [ ] 건수 검증",
      "- [x] 교체 트랜잭션",
      "",
      "***",
      "",
      "```sql",
      "SELECT 1;",
      "```",
      "",
      "끝.",
    ].join("\n");
    const doc = markdownToDoc(md);
    expect(() => Node.fromJSON(wikiLike, doc).check()).not.toThrow();

    const leftovers: string[] = [];
    const walk = (n: JSONContent) => {
      if (n.type === "paragraph") {
        const t = text(n);
        if (/^\s*(\||>|[-*+]\s|\d+[.)]\s|#{1,6}\s|```|-{3,}$|\*{3,}$|\[[ xX]\]\s)/.test(t) || /\|\s*:?-{3,}/.test(t))
          leftovers.push(t);
      }
      (n.content ?? []).forEach(walk);
    };
    walk(doc);
    expect(leftovers).toEqual([]);
    expect(doc.content!.map((n) => n.type)).toEqual([
      "heading", "blockquote", "heading", "table", "mermaidBlock",
      "orderedList", "taskList", "horizontalRule", "codeBlock", "paragraph",
    ]);
  });
});
