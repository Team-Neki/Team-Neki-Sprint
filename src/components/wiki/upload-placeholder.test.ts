import { describe, expect, it } from "vitest";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { Schema } from "@tiptap/pm/model";
import {
  addUploadPlaceholder,
  findUploadPlaceholder,
  removeUploadPlaceholder,
  uploadPlaceholderPlugin,
} from "./upload-placeholder";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    text: {},
  },
});

// <p>hello world</p> — 텍스트는 pos 1 에서 시작, 문단 끝은 pos 12.
function createView() {
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text("hello world")]),
  ]);
  const view = {
    state: EditorState.create({ doc, plugins: [uploadPlaceholderPlugin()] }),
    dispatch(tr: Transaction) {
      view.state = view.state.apply(tr);
    },
  };
  return view;
}

describe("uploadPlaceholderPlugin", () => {
  it("추가한 placeholder 의 위치를 찾는다", () => {
    const view = createView();
    const id = {};
    addUploadPlaceholder(view, id, 6);
    expect(findUploadPlaceholder(view.state, id)).toBe(6);
  });

  it("placeholder 앞에 입력하면 위치가 함께 밀린다", () => {
    const view = createView();
    const id = {};
    addUploadPlaceholder(view, id, 6);
    view.dispatch(view.state.tr.insertText("abc", 1));
    expect(findUploadPlaceholder(view.state, id)).toBe(9);
  });

  it("placeholder 뒤 편집은 위치에 영향을 주지 않는다", () => {
    const view = createView();
    const id = {};
    addUploadPlaceholder(view, id, 6);
    view.dispatch(view.state.tr.insertText("abc", 8));
    expect(findUploadPlaceholder(view.state, id)).toBe(6);
  });

  it("placeholder 를 포함한 범위를 지우면 사라진다(null)", () => {
    const view = createView();
    const id = {};
    addUploadPlaceholder(view, id, 6);
    view.dispatch(view.state.tr.delete(3, 9));
    expect(findUploadPlaceholder(view.state, id)).toBeNull();
  });

  it("remove 로 제거하면 더 이상 찾을 수 없다", () => {
    const view = createView();
    const id = {};
    addUploadPlaceholder(view, id, 6);
    removeUploadPlaceholder(view, id);
    expect(findUploadPlaceholder(view.state, id)).toBeNull();
  });

  it("여러 placeholder 는 id 로 독립적으로 관리된다", () => {
    const view = createView();
    const a = {};
    const b = {};
    addUploadPlaceholder(view, a, 2);
    addUploadPlaceholder(view, b, 6);
    removeUploadPlaceholder(view, a);
    expect(findUploadPlaceholder(view.state, a)).toBeNull();
    expect(findUploadPlaceholder(view.state, b)).toBe(6);
  });
});
