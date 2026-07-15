import { Extension } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

/**
 * 표 편집 보조 키맵.
 * - ArrowLeft: 표 바로 아래 블록의 맨 앞에서 왼쪽으로 이동하면 그 표를 통째로
 *   선택(NodeSelection)한다 → 표가 하이라이트된 상태에서 Backspace/Delete 로 삭제.
 * - Backspace/Delete: 표가 선택돼 있으면 표를 삭제. (선택 안 됐고 표 아래 맨 앞이면
 *   Backspace 는 먼저 표를 선택 → 한 번 더 눌러 삭제.)
 * codeBlock 등과 무관하게 표 경계에서만 동작한다.
 */
export const TableControls = Extension.create({
  name: "tableControls",

  addKeyboardShortcuts() {
    // 커서가 텍스트블록 맨 앞이고 바로 앞 형제가 표면 그 표를 선택한다.
    const selectTableBefore = (): boolean => {
      const { state } = this.editor;
      const { selection } = state;
      const { $from, empty } = selection;
      if (!empty || $from.parentOffset !== 0) return false;
      const depth = $from.depth;
      const index = $from.index(depth - 1);
      if (index === 0) return false;
      const prev = $from.node(depth - 1).child(index - 1);
      if (prev.type.name !== "table") return false;
      const tableStart = $from.before(depth) - prev.nodeSize;
      return this.editor.chain().setNodeSelection(tableStart).run();
    };

    const deleteSelectedTable = (): boolean => {
      const { selection } = this.editor.state;
      if (
        selection instanceof NodeSelection &&
        selection.node.type.name === "table"
      ) {
        return this.editor.chain().deleteSelection().run();
      }
      return false;
    };

    return {
      ArrowLeft: selectTableBefore,
      Backspace: () => deleteSelectedTable() || selectTableBefore(),
      Delete: deleteSelectedTable,
    };
  },
});
