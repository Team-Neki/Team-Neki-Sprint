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
    const to = from + node.content.size;
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)),
    );
    return false;
  }

  return false;
}
