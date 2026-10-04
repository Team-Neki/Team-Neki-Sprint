import { describe, expect, it } from "vitest";
import { Fragment, Schema, Slice, type Node } from "@tiptap/pm/model";
import { cleanNotionPaste, isLoadableImageSrc } from "./notion-paste";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    blockquote: { group: "block", content: "block+" },
    bulletList: { group: "block", content: "listItem+" },
    listItem: { content: "paragraph block*" },
    image: { group: "block", attrs: { src: { default: null } } },
    text: { group: "inline" },
    hardBreak: { group: "inline", inline: true },
  },
});

const p = (...parts: (string | Node)[]) =>
  schema.node(
    "paragraph",
    null,
    parts.map((x) => (typeof x === "string" ? schema.text(x) : x)),
  );
const br = () => schema.node("hardBreak");
const img = (src: string) => schema.node("image", { src });
const slice = (...nodes: Node[]) => new Slice(Fragment.fromArray(nodes), 0, 0);
const json = (s: Slice) => s.content.toJSON();

describe("isLoadableImageSrc", () => {
  it("업로드 경로와 http(s) 만 불러올 수 있다", () => {
    expect(isLoadableImageSrc("/api/wiki/image/abc")).toBe(true);
    expect(isLoadableImageSrc("https://example.com/a.png")).toBe(true);
    expect(isLoadableImageSrc("attachment:307b:image.png")).toBe(false);
    expect(isLoadableImageSrc("file:///Users/a.png")).toBe(false);
    expect(isLoadableImageSrc(null)).toBe(false);
  });
});

describe("cleanNotionPaste", () => {
  it("바꿀 것이 없으면 같은 slice 를 그대로 돌려준다", () => {
    const s = slice(p("hello"), img("/api/wiki/image/1"));
    const out = cleanNotionPaste(s);
    expect(out.slice).toBe(s);
    expect(out.dropped).toBe(0);
  });

  it("Notion 첨부 이미지(attachment:)는 빼고 개수를 센다", () => {
    const out = cleanNotionPaste(
      slice(p("a"), img("attachment:1:x.png"), img("https://e.com/b.png")),
    );
    expect(out.dropped).toBe(1);
    expect(json(out.slice)).toEqual(
      Fragment.fromArray([p("a"), img("https://e.com/b.png")]).toJSON(),
    );
  });

  it("첨부 이미지만 붙여넣으면 아무것도 넣지 않는다", () => {
    const out = cleanNotionPaste(slice(img("attachment:1:x.png")));
    expect(out.slice.size).toBe(0);
    expect(out.dropped).toBe(1);
  });

  it("<aside> ... </aside> 문단을 인용 블록으로 감싸고 아이콘을 첫 문단에 붙인다", () => {
    const out = cleanNotionPaste(
      slice(
        p("before"),
        p("<aside>", br(), "💡"),
        p("https://report"),
        p("second line"),
        p("</aside>"),
        p("after"),
      ),
    );
    expect(json(out.slice)).toEqual(
      Fragment.fromArray([
        p("before"),
        schema.node("blockquote", null, [
          p("💡 https://report"),
          p("second line"),
        ]),
        p("after"),
      ]).toJSON(),
    );
  });

  it("목록 항목 안의 콜아웃도 바꾼다", () => {
    const out = cleanNotionPaste(
      slice(
        schema.node("bulletList", null, [
          schema.node("listItem", null, [
            p("item"),
            p("<aside>", br(), "💡"),
            p("note"),
            p("</aside>"),
          ]),
        ]),
      ),
    );
    expect(json(out.slice)).toEqual(
      Fragment.fromArray([
        schema.node("bulletList", null, [
          schema.node("listItem", null, [
            p("item"),
            schema.node("blockquote", null, [p("💡 note")]),
          ]),
        ]),
      ]).toJSON(),
    );
  });

  it("한 문단 안에 시작·끝 표시가 함께 있어도 감싼다", () => {
    const out = cleanNotionPaste(slice(p("<aside>", br(), "📌 짧은 메모</aside>")));
    expect(json(out.slice)).toEqual(
      Fragment.fromArray([
        schema.node("blockquote", null, [p("📌 짧은 메모")]),
      ]).toJSON(),
    );
  });

  it("끝 표시가 없으면(콜아웃 일부만 복사) 그대로 둔다", () => {
    const s = slice(p("<aside>", br(), "💡"), p("note"));
    expect(cleanNotionPaste(s).slice).toBe(s);
  });

  it("콜아웃 안의 첨부 이미지도 뺀다", () => {
    const out = cleanNotionPaste(
      slice(p("<aside>"), p("text"), img("attachment:1:y.png"), p("</aside>")),
    );
    expect(out.dropped).toBe(1);
    expect(json(out.slice)).toEqual(
      Fragment.fromArray([schema.node("blockquote", null, [p("text")])]).toJSON(),
    );
  });
});
