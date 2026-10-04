import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * 위키 본문의 triple-click에서 현재 텍스트 블록을 선택한다.
 *
 * ProseMirror에도 기본 triple-click 처리가 있지만, 읽기전용 NodeView와 함께
 * 사용할 때도 뷰/브라우저에 관계없이 같은 선택 범위를 보장하기 위해 명시한다.
 * 텍스트 블록은 직접 선택한 뒤 false를 반환한다. 그래야 ProseMirror가 기본
 * triple-click 드래그 추적을 시작해, 마우스를 움직일 때 다른 블록까지 범위를
 * 확장한다. 텍스트 블록이 아닌 이미지·파일·다이어그램 등은 직접 처리하지 않아
 * 기본 노드 선택 동작을 그대로 사용한다.
 *
 * 코드블록은 블록 하나가 텍스트 블록이라 위 동작이면 코드 전체가 잡힌다. 그래서
 * 클릭한 줄(앞뒤 \n 사이, 줄바꿈 제외)만 선택하고 true 를 반환한다. false 면 기본
 * 처리가 다시 블록 전체로 넓히기 때문이다(대신 코드블록에선 드래그 확장이 없다).
 */
export function selectWikiLine(
  view: EditorView,
  pos: number,
  event: MouseEvent,
): boolean {
  if (event.button !== 0) return false;

  const $pos = view.state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (!node.isTextblock) continue;

    const from = $pos.start(depth);

    if (node.type.spec.code) {
      // 코드블록 내용은 텍스트뿐이라 문자 오프셋 = 위치 오프셋.
      const text = node.textContent;
      const offset = pos - from;
      const lineStart = text.slice(0, offset).lastIndexOf("\n") + 1;
      const nl = text.indexOf("\n", offset);
      const lineEnd = nl === -1 ? text.length : nl;
      // 기본 처리(updateSelection)를 건너뛰므로 포커스·pointer 메타를 직접 맞춘다.
      if (!view.hasFocus()) view.focus();
      view.dispatch(
        view.state.tr
          .setSelection(
            TextSelection.create(view.state.doc, from + lineStart, from + lineEnd),
          )
          .setMeta("pointer", true),
      );
      return true;
    }

    const to = from + node.content.size;
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)),
    );
    return false;
  }

  return false;
}
