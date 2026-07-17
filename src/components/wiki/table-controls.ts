import { Extension } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { CellSelection, selectedRect } from "@tiptap/pm/tables";

/**
 * 표 편집 보조 키맵.
 * - ArrowLeft: 표 바로 아래 블록의 맨 앞에서 왼쪽으로 이동하면 그 표를 통째로
 *   선택(NodeSelection)한다 → 표가 하이라이트된 상태에서 Backspace/Delete 로 삭제.
 * - Backspace/Delete: 표가 선택돼 있으면 표를 삭제. (선택 안 됐고 표 아래 맨 앞이면
 *   Backspace 는 먼저 표를 선택 → 한 번 더 눌러 삭제.)
 * - Ctrl+Option(Alt)+방향키: 커서 셀 기준 왼쪽/오른쪽 열 · 위/아래 행 추가(T22).
 * - Ctrl+Backspace: 드래그로 "행/열 전체"를 선택한 상태에서 그 행/열 삭제.
 *   행·열이 모두 전체 선택(=표 전체)이면 표 삭제(T22). prosemirror-tables 의
 *   deleteRow/deleteColumn 은 전체 선택을 거부하므로 이 경우만 deleteTable.
 * codeBlock 등과 무관하게 표 경계/내부에서만 동작한다.
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

    // 표 안에서만 동작하는 커서 기준 행/열 추가. 표 밖이면 false 로 기본 동작에 넘긴다.
    const inTable = (): boolean => this.editor.isActive("table");
    const addColumnLeft = (): boolean =>
      inTable() && this.editor.chain().focus().addColumnBefore().run();
    const addColumnRight = (): boolean =>
      inTable() && this.editor.chain().focus().addColumnAfter().run();
    const addRowAbove = (): boolean =>
      inTable() && this.editor.chain().focus().addRowBefore().run();
    const addRowBelow = (): boolean =>
      inTable() && this.editor.chain().focus().addRowAfter().run();

    // 드래그로 행/열 전체를 선택(CellSelection)한 상태의 Ctrl+Backspace 삭제.
    const deleteSelectedRowsOrCols = (): boolean => {
      const { state } = this.editor;
      if (!(state.selection instanceof CellSelection)) return false;
      const rect = selectedRect(state);
      const fullWidth = rect.left === 0 && rect.right === rect.map.width;
      const fullHeight = rect.top === 0 && rect.bottom === rect.map.height;
      if (fullWidth && fullHeight) {
        // 선택 구간이 표 전체 — 행 삭제 = 표 전체 삭제.
        return this.editor.chain().focus().deleteTable().run();
      }
      if (fullWidth) return this.editor.chain().focus().deleteRow().run();
      if (fullHeight) return this.editor.chain().focus().deleteColumn().run();
      return false;
    };

    return {
      ArrowLeft: selectTableBefore,
      Backspace: () => deleteSelectedTable() || selectTableBefore(),
      Delete: deleteSelectedTable,
      "Ctrl-Alt-ArrowLeft": addColumnLeft,
      "Ctrl-Alt-ArrowRight": addColumnRight,
      "Ctrl-Alt-ArrowUp": addRowAbove,
      "Ctrl-Alt-ArrowDown": addRowBelow,
      "Ctrl-Backspace": deleteSelectedRowsOrCols,
    };
  },
});
