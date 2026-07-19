// 표 구조 편집 헬퍼(T22). prosemirror-tables 의 low-level API(addRow/addColumn/
// removeRow/removeColumn + TableMap)로 "항상 마지막에 추가" · "빈 행/열만 끝에서
// 삭제" 를 구현한다. hover 스트립(+ 드래그)과 단축키·컨텍스트 메뉴가 공유한다.
//
// TipTap 의 addRowAfter/addColumnAfter 는 커서 셀 기준이라 추가 위치가 커서에
// 따라 달라진다 — 여기 헬퍼는 커서와 무관하게 표 끝에 붙인다.

import type { Editor } from "@tiptap/core";
import { NodeSelection, type EditorState } from "@tiptap/pm/state";
import type { Node as PmNode } from "@tiptap/pm/model";
import {
  TableMap,
  CellSelection,
  addRow,
  addColumn,
  removeRow,
  removeColumn,
} from "@tiptap/pm/tables";

export type TableCtx = { table: PmNode; tableStart: number; map: TableMap };

/** 선택을 둘러싼 표(없으면 null). tableStart = 표 첫 자식 위치(prosemirror-tables 규약). */
export function tableAroundSelection(state: EditorState): TableCtx | null {
  const sel = state.selection;
  // 표 자체가 NodeSelection(ArrowLeft→표 선택 흐름)이면 $from 조상엔 표가 없다 —
  // 선택된 노드를 직접 표 컨텍스트로 반환한다.
  if (sel instanceof NodeSelection && sel.node.type.name === "table") {
    return {
      table: sel.node,
      tableStart: sel.from + 1,
      map: TableMap.get(sel.node),
    };
  }
  const { $from } = sel;
  for (let d = $from.depth; d > 0; d -= 1) {
    const node = $from.node(d);
    if (node.type.name === "table") {
      return { table: node, tableStart: $from.start(d), map: TableMap.get(node) };
    }
  }
  return null;
}

/** addRow/removeRow 등이 요구하는 rect 인자(map/tableStart/table 만 사용된다). */
function asRect(ctx: TableCtx) {
  return {
    left: 0,
    top: 0,
    right: ctx.map.width,
    bottom: ctx.map.height,
    ...ctx,
  };
}

/** 셀에 내용이 있는지: 공백 아닌 텍스트 또는 원자 블록(이미지·mermaid·멘션 등). */
export function cellIsEmpty(cell: PmNode): boolean {
  let empty = true;
  cell.descendants((node) => {
    if (!empty) return false;
    if (node.isText) {
      if (node.text && node.text.trim().length > 0) empty = false;
    } else if (node.isLeaf && !node.isTextblock) {
      empty = false;
    }
    return empty;
  });
  return empty;
}

function rowIsEmpty(ctx: TableCtx, row: number): boolean {
  for (let col = 0; col < ctx.map.width; col += 1) {
    const cell = ctx.table.nodeAt(ctx.map.map[row * ctx.map.width + col]);
    if (cell && !cellIsEmpty(cell)) return false;
  }
  return true;
}

function colIsEmpty(ctx: TableCtx, col: number): boolean {
  for (let row = 0; row < ctx.map.height; row += 1) {
    const cell = ctx.table.nodeAt(ctx.map.map[row * ctx.map.width + col]);
    if (cell && !cellIsEmpty(cell)) return false;
  }
  return true;
}

/** 표 마지막에 행 추가(커서 위치 무관). 표 밖이면 false. */
export function appendRowEnd(editor: Editor): boolean {
  const ctx = tableAroundSelection(editor.state);
  if (!ctx) return false;
  editor.view.dispatch(addRow(editor.state.tr, asRect(ctx), ctx.map.height));
  return true;
}

/** 표 마지막에 열 추가(커서 위치 무관). 표 밖이면 false. */
export function appendColumnEnd(editor: Editor): boolean {
  const ctx = tableAroundSelection(editor.state);
  if (!ctx) return false;
  editor.view.dispatch(addColumn(editor.state.tr, asRect(ctx), ctx.map.width));
  return true;
}

/**
 * 마지막 행이 전부 빈 셀이면 삭제. 내용이 있는 행을 만나면 false(드래그 축소는
 * 여기서 멈춘다). 행이 1개뿐이면 삭제하지 않는다(표 삭제는 별도 동작).
 */
export function removeLastRowIfEmpty(editor: Editor): boolean {
  const ctx = tableAroundSelection(editor.state);
  if (!ctx || ctx.map.height <= 1) return false;
  if (!rowIsEmpty(ctx, ctx.map.height - 1)) return false;
  const tr = editor.state.tr;
  removeRow(tr, asRect(ctx), ctx.map.height - 1);
  editor.view.dispatch(tr);
  return true;
}

/** 마지막 열이 전부 빈 셀이면 삭제(위와 동일 규칙, 열이 1개뿐이면 유지). */
export function removeLastColumnIfEmpty(editor: Editor): boolean {
  const ctx = tableAroundSelection(editor.state);
  if (!ctx || ctx.map.width <= 1) return false;
  if (!colIsEmpty(ctx, ctx.map.width - 1)) return false;
  const tr = editor.state.tr;
  removeColumn(tr, asRect(ctx), ctx.map.width - 1);
  editor.view.dispatch(tr);
  return true;
}

/** col 열 전체 선택(CellSelection). hover 선택 스트립(T22 후속)이 쓴다. */
export function selectColumn(editor: Editor, col: number): boolean {
  const ctx = tableAroundSelection(editor.state);
  if (!ctx || col < 0 || col >= ctx.map.width) return false;
  const cellPos = ctx.tableStart + ctx.map.map[col];
  const sel = CellSelection.colSelection(editor.state.doc.resolve(cellPos));
  editor.view.dispatch(editor.state.tr.setSelection(sel));
  editor.view.focus();
  return true;
}

/** row 행 전체 선택(CellSelection). */
export function selectRow(editor: Editor, row: number): boolean {
  const ctx = tableAroundSelection(editor.state);
  if (!ctx || row < 0 || row >= ctx.map.height) return false;
  const cellPos = ctx.tableStart + ctx.map.map[row * ctx.map.width];
  const sel = CellSelection.rowSelection(editor.state.doc.resolve(cellPos));
  editor.view.dispatch(editor.state.tr.setSelection(sel));
  editor.view.focus();
  return true;
}

/**
 * 헤더 행(첫 행) 전체 셀에 배경색 일괄 적용(null=기본으로 복원).
 * setCellAttribute 는 현재 선택 기준이라, 커서 위치와 무관하게 첫 행을
 * 대상으로 하는 이 헬퍼는 setNodeMarkup 으로 직접 적용한다.
 */
export function setHeaderRowBackground(
  editor: Editor,
  color: string | null,
): boolean {
  const ctx = tableAroundSelection(editor.state);
  if (!ctx) return false;
  const tr = editor.state.tr;
  const seen = new Set<number>();
  for (let col = 0; col < ctx.map.width; col += 1) {
    const rel = ctx.map.map[col]; // 첫 행(row 0)의 col 번째 셀(colspan 중복 제거)
    if (seen.has(rel)) continue;
    seen.add(rel);
    const pos = ctx.tableStart + rel;
    const cell = editor.state.doc.nodeAt(pos);
    if (!cell) continue;
    tr.setNodeMarkup(pos, undefined, { ...cell.attrs, backgroundColor: color });
  }
  editor.view.dispatch(tr);
  return true;
}
