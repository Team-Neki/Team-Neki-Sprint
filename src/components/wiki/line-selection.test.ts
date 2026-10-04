import { describe, expect, it } from "vitest";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { Schema } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { selectWikiLine } from "./line-selection";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    codeBlock: { group: "block", content: "text*", code: true },
    text: {},
  },
});

// <pre>ab\ncd\n\nef</pre><p>hello</p> — 코드 텍스트는 pos 1 에서 시작.
function createView() {
  const doc = schema.node("doc", null, [
    schema.node("codeBlock", null, [schema.text("ab\ncd\n\nef")]),
    schema.node("paragraph", null, [schema.text("hello")]),
  ]);
  const view = {
    state: EditorState.create({ doc }),
    dispatch(tr: Transaction) {
      view.state = view.state.apply(tr);
    },
    hasFocus: () => true,
    focus() {},
  };
  return view;
}

function tripleClick(pos: number) {
  const view = createView();
  const handled = selectWikiLine(
    view as unknown as EditorView,
    pos,
    { button: 0 } as MouseEvent,
  );
  const { from, to } = view.state.selection;
  return { handled, text: view.state.doc.textBetween(from, to) };
}

describe("selectWikiLine", () => {
  it("코드블록에선 클릭한 줄만 선택하고 기본 처리를 막는다", () => {
    expect(tripleClick(1)).toEqual({ handled: true, text: "ab" }); // 첫 줄 시작
    expect(tripleClick(3)).toEqual({ handled: true, text: "ab" }); // 줄 끝(\n 앞)
    expect(tripleClick(5)).toEqual({ handled: true, text: "cd" }); // 가운데 줄
    expect(tripleClick(7)).toEqual({ handled: true, text: "" }); // 빈 줄
    expect(tripleClick(9)).toEqual({ handled: true, text: "ef" }); // 마지막 줄
  });

  it("일반 문단은 블록 전체를 선택하고 기본 처리(드래그 확장)에 넘긴다", () => {
    expect(tripleClick(14)).toEqual({ handled: false, text: "hello" });
  });
});
