import { Extension } from "@tiptap/core";
import {
  Plugin,
  PluginKey,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * 이미지 업로드 placeholder 플러그인(ProseMirror upload placeholder 패턴).
 *
 * 업로드는 비동기라 끝나는 시점의 selection/문서는 시작 시점과 다를 수 있다 —
 * 그 사이 사용자가 타이핑/삭제하면 "완료 시점 기준" 삽입은 원래 붙여넣기/드롭한
 * 위치를 벗어난다. 그래서 업로드 시작 시 위젯 데코레이션을 삽입 위치에 박아 두고,
 * 문서가 바뀔 때마다 tr.mapping 으로 함께 이동시킨 뒤, 완료 시 그 위치를 조회해
 * 이미지를 삽입한다. 데코레이션은 문서 밖(뷰 레이어)이라 스키마·저장 내용에는
 * 영향이 없다.
 */

type PlaceholderAction =
  | { add: { id: object; pos: number } }
  | { remove: { id: object } };

const uploadPlaceholderKey = new PluginKey<DecorationSet>(
  "wikiUploadPlaceholder",
);

// 위젯 DOM 은 렌더 시점에 생성한다(함수형 위젯) — 플러그인 상태 로직이 DOM 에
// 의존하지 않아 Node 환경 단위 테스트가 가능하다. 스타일은 globals.css 참고.
function placeholderWidget(): HTMLElement {
  const el = document.createElement("span");
  el.className = "wiki-image-uploading";
  el.textContent = "이미지 업로드 중…";
  return el;
}

export function uploadPlaceholderPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: uploadPlaceholderKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        // 문서 변경(타이핑·삭제)에 맞춰 placeholder 위치를 이동한다. placeholder
        // 를 포함한 범위가 삭제되면 데코레이션도 함께 사라진다(→ find 가 null).
        let next = set.map(tr.mapping, tr.doc);
        const action = tr.getMeta(uploadPlaceholderKey) as
          | PlaceholderAction
          | undefined;
        if (action && "add" in action) {
          next = next.add(tr.doc, [
            Decoration.widget(action.add.pos, placeholderWidget, {
              id: action.add.id,
            }),
          ]);
        } else if (action && "remove" in action) {
          next = next.remove(
            next.find(undefined, undefined, (spec) => spec.id === action.remove.id),
          );
        }
        return next;
      },
    },
    props: {
      decorations(state) {
        return uploadPlaceholderKey.getState(state);
      },
    },
  });
}

/** 에디터(편집 모드)에만 배선하는 확장. 읽기전용 뷰에는 필요 없다. */
export const UploadPlaceholder = Extension.create({
  name: "uploadPlaceholder",
  addProseMirrorPlugins() {
    return [uploadPlaceholderPlugin()];
  },
});

/** dispatch 가능한 최소 인터페이스(EditorView 또는 테스트 대역). */
type Dispatcher = {
  state: EditorState;
  dispatch: (tr: Transaction) => void;
};

/** id 로 식별되는 placeholder 를 pos 에 추가. id 는 참조 동일성으로 비교한다. */
export function addUploadPlaceholder(
  view: Dispatcher,
  id: object,
  pos: number,
) {
  view.dispatch(view.state.tr.setMeta(uploadPlaceholderKey, { add: { id, pos } }));
}

export function removeUploadPlaceholder(view: Dispatcher, id: object) {
  view.dispatch(view.state.tr.setMeta(uploadPlaceholderKey, { remove: { id } }));
}

/** placeholder 의 현재(매핑된) 위치. 사용자가 그 자리를 지웠으면 null. */
export function findUploadPlaceholder(
  state: EditorState,
  id: object,
): number | null {
  const found = uploadPlaceholderKey
    .getState(state)
    ?.find(undefined, undefined, (spec) => spec.id === id);
  return found && found.length > 0 ? found[0].from : null;
}
