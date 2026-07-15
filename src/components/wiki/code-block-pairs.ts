import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";

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

// Enter 자동 들여쓰기 대상: 블록을 여는 { , [ 만(소괄호 ( 는 제외). 직전 글자가
// 이 여는 괄호일 때만 들여쓴다. 한 단계 들여쓰기 폭 = 2 스페이스.
const BLOCK_OPEN_TO_CLOSE: Record<string, string> = { "{": "}", "[": "]" };
const INDENT = "  ";

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

/**
 * 코드블록 Enter 자동 들여쓰기(편집 모드). codeBlock 노드 안에서만 동작.
 * - 커서 앞 글자가 여는 블록 괄호({ 또는 [) 이면 한 단계 더 들여쓴다.
 *   - 빈 짝 사이(예: {|}) 에서 Enter → 세 줄로 펼치고 가운데 줄을 한 단계 더
 *     들여쓴 뒤 커서를 그 줄에 둔다(닫는 괄호는 아래 줄 원 들여쓰기).
 *   - 여는 괄호로 줄이 끝난 경우 → 다음 줄을 한 단계 들여쓴다.
 * - 그 외: 현재 줄의 선행 공백을 그대로 유지(들여쓰기 연속). 들여쓰기가 없으면
 *   기본 줄바꿈에 맡긴다(false).
 */
export function codeBlockEnterIndent(
  editor: Editor,
  codeBlockName: string,
): boolean {
  const { state } = editor;
  const { selection } = state;
  const { $from, empty } = selection;
  if (!empty) return false;
  if ($from.parent.type.name !== codeBlockName) return false;

  const content = $from.parent.textContent;
  const offset = $from.parentOffset;

  // 현재 줄의 선행 공백(들여쓰기 기준).
  const before = content.slice(0, offset);
  const lineStart = before.lastIndexOf("\n") + 1;
  const baseIndent = before.slice(lineStart).match(/^[ \t]*/)?.[0] ?? "";

  const charBefore = content.slice(offset - 1, offset);
  const charAfter = content.slice(offset, offset + 1);
  const pos = $from.pos;
  const close = BLOCK_OPEN_TO_CLOSE[charBefore];

  // { , [ 뒤: 한 단계 더 들여쓰기.
  if (close) {
    const innerIndent = baseIndent + INDENT;
    if (charAfter === close) {
      // 빈 짝 사이: 세 줄로 펼치고 커서를 가운데(들여쓴) 줄에 둔다.
      const tr = state.tr.insertText(`\n${innerIndent}\n${baseIndent}`, pos);
      tr.setSelection(
        TextSelection.create(tr.doc, pos + 1 + innerIndent.length),
      );
      editor.view.dispatch(tr.scrollIntoView());
      return true;
    }
    const tr = state.tr.insertText(`\n${innerIndent}`, pos);
    tr.setSelection(TextSelection.create(tr.doc, pos + 1 + innerIndent.length));
    editor.view.dispatch(tr.scrollIntoView());
    return true;
  }

  // 그 외: 현재 줄의 들여쓰기 유지. 들여쓰기가 없으면 기본 줄바꿈에 맡긴다.
  if (!baseIndent) return false;
  const tr = state.tr.insertText(`\n${baseIndent}`, pos);
  tr.setSelection(TextSelection.create(tr.doc, pos + 1 + baseIndent.length));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}
