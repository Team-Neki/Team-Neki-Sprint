import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

// 여는 문자 → 닫는 문자 짝. 따옴표는 여닫이가 같다.
const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
};
const CLOSERS = new Set(Object.values(PAIRS));

/**
 * 코드블록 안에서만 동작하는 괄호/따옴표 자동 닫기 ProseMirror 플러그인.
 *
 * - 여는 문자 입력 → 닫는 짝을 함께 넣고 커서를 사이에 둔다.
 * - 선택 영역이 있으면 그 영역을 짝으로 감싼다.
 * - 이미 있는 닫는 문자 위에서 같은 닫는 문자를 다시 치면 새로 넣지 않고 커서만
 *   넘긴다(type-over) → 자동 삽입된 닫는 문자와 이중 입력되지 않는다.
 * - 커서 바로 뒤가 공백/닫는 문자가 아닌 일반 글자면 자동 닫기를 생략(기존 토큰
 *   앞에서 여는 괄호만 넣고 싶은 경우).
 *
 * codeBlock 노드 밖(일반 본문)에서는 관여하지 않는다.
 */
export function codeBlockAutoPairs(codeBlockName: string) {
  return new Plugin({
    key: new PluginKey("codeBlockAutoPairs"),
    props: {
      handleTextInput(view, from, to, text) {
        if (text.length !== 1) return false;
        const { state } = view;
        const $from = state.doc.resolve(from);
        // 코드블록 안에서만.
        if ($from.parent.type.name !== codeBlockName) return false;

        const content = $from.parent.textContent;
        const nextChar = content.slice($from.parentOffset, $from.parentOffset + 1);

        // type-over: 닫는 문자를 이미 같은 닫는 문자 위에서 다시 치면 커서만 넘긴다.
        if (from === to && CLOSERS.has(text) && nextChar === text) {
          view.dispatch(
            state.tr
              .setSelection(TextSelection.create(state.doc, to + 1))
              .scrollIntoView(),
          );
          return true;
        }

        const close = PAIRS[text];
        if (!close) return false; // 여는 문자가 아니면 기본 처리.

        // 선택 영역 감싸기(양 끝이 같은 코드블록일 때만).
        if (from !== to) {
          const $to = state.doc.resolve(to);
          if ($to.parent !== $from.parent) return false;
          const tr = state.tr.insertText(close, to).insertText(text, from);
          tr.setSelection(TextSelection.create(tr.doc, from + 1, to + 1));
          view.dispatch(tr.scrollIntoView());
          return true;
        }

        // 커서 바로 뒤가 일반 글자면 자동 닫기 생략.
        if (nextChar && !/[\s)\]}"'`]/.test(nextChar)) return false;

        const tr = state.tr.insertText(text + close, from, to);
        tr.setSelection(TextSelection.create(tr.doc, from + 1));
        view.dispatch(tr.scrollIntoView());
        return true;
      },
    },
  });
}
