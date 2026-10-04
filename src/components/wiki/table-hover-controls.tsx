"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { Plus, Trash2 } from "lucide-react";
import {
  appendColumnEnd,
  appendRowEnd,
  removeLastColumnIfEmpty,
  removeLastRowIfEmpty,
  selectColumn,
  selectRow,
} from "@/components/wiki/table-edit";

/**
 * 표 가장자리 hover 열/행 추가 버튼(T17). 커서가 표 안에 있을 때, 그 표의 DOM
 * 사각형을 추적해 우측(열 추가)·하단(행 추가) 스트립을 오버레이한다. 스트립에
 * hover 하면 + 버튼이 나타나고, 클릭 시 마지막 열/행 뒤에 추가·드래그로 여러 개
 * 추가/삭제(table-edit.ts). 표 내부 로직은 건드리지 않고 좌표만 읽어 겹쳐
 * 그리므로 리사이즈/편집 동작과 독립적이다. (공지 에디터도 재사용 — export)
 */
export function TableHoverControls({
  editor,
  containerRef,
}: {
  editor: Editor;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  // 열/행 선택 스트립(상단/좌측). 첫 행 셀들의 x/폭, 각 tr 의 y/높이로 계산한다.
  // (첫 행에 colspan 이 있으면 병합 폭 기준 — 팀 사용 패턴상 단순 표가 대부분)
  const [cols, setCols] = useState<{ left: number; width: number }[]>([]);
  const [rows, setRows] = useState<{ top: number; height: number }[]>([]);

  useEffect(() => {
    function update() {
      const container = containerRef.current;
      if (!container || editor.isDestroyed) {
        setRect(null);
        return;
      }
      const { $from } = editor.state.selection;
      let tablePos = -1;
      for (let d = $from.depth; d > 0; d -= 1) {
        if ($from.node(d).type.name === "table") {
          tablePos = $from.before(d);
          break;
        }
      }
      if (tablePos < 0) {
        setRect(null);
        return;
      }
      const dom = editor.view.nodeDOM(tablePos) as HTMLElement | null;
      const tableEl = dom?.querySelector("table") ?? dom;
      if (!tableEl) {
        setRect(null);
        return;
      }
      const tr = tableEl.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      setRect({
        top: tr.top - cr.top,
        left: tr.left - cr.left,
        width: tr.width,
        height: tr.height,
      });
      const trEls = Array.from(tableEl.querySelectorAll("tr"));
      setRows(
        trEls.map((el) => {
          const r = el.getBoundingClientRect();
          return { top: r.top - cr.top, height: r.height };
        }),
      );
      setCols(
        Array.from(trEls[0]?.children ?? []).map((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return { left: r.left - cr.left, width: r.width };
        }),
      );
    }
    update();
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [editor, containerRef]);

  // 열/행 추가·삭제를 드래그로 여러 개. 오른쪽/아래로 끌면 STEP 픽셀마다 마지막에
  // 한 개씩 추가, 반대 방향으로 끌면 끝에서부터 한 개씩 삭제한다(빈 행/열까지만 —
  // 내용 있는 셀을 만나면 멈춘다. table-edit.ts). 드래그 없이 클릭하면 한 개만 추가.
  function resizeByDrag(
    e: React.PointerEvent,
    axis: "x" | "y",
    add: () => boolean,
    remove: () => boolean,
  ) {
    e.preventDefault();
    const start = axis === "x" ? e.clientX : e.clientY;
    const STEP = axis === "x" ? 48 : 32;
    let net = 0; // 이 드래그로 순증감한 개수(음수 = 삭제)
    let dragged = false;
    const onMove = (ev: PointerEvent) => {
      const pos = axis === "x" ? ev.clientX : ev.clientY;
      // trunc: 시작점 주변 미세 이동(±STEP 미만)으로 바로 삭제되지 않게.
      const target = Math.trunc((pos - start) / STEP);
      if (target !== 0) dragged = true;
      while (net < target) {
        if (!add()) break;
        net += 1;
      }
      while (net > target) {
        if (!remove()) break; // 내용 있는 행/열 → 더 줄이지 않음
        net -= 1;
      }
    };
    // pointercancel(터치 제스처·OS 개입)에도 전역 리스너를 정리한다 — 안 하면
    // 리스너가 남아 이후 포인터 이동이 표를 계속 변경한다.
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
    };
    const onUp = () => {
      if (!dragged && net === 0) add(); // 클릭 = 1개 추가
      cleanup();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cleanup);
  }

  // 추가는 커서 위치와 무관하게 항상 마지막 열/행 뒤에(T22).
  const addColumn = () => appendColumnEnd(editor);
  const addRow = () => appendRowEnd(editor);
  const shrinkColumn = () => removeLastColumnIfEmpty(editor);
  const shrinkRow = () => removeLastRowIfEmpty(editor);

  if (!rect) return null;
  return (
    <>
      {/* 상단: 열별 선택 스트립(클릭 = 열 전체 CellSelection → 우클릭 메뉴/단축키 연계) */}
      {cols.map((c, i) => (
        <button
          key={`col-${i}`}
          type="button"
          aria-label={`${i + 1}열 선택`}
          title="열 선택"
          className="wiki-table-pick wiki-table-pick-col"
          style={{ top: rect.top - 8, left: c.left, width: c.width }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => selectColumn(editor, i)}
        />
      ))}
      {/* 좌측: 행별 선택 스트립(클릭 = 행 전체 CellSelection) */}
      {rows.map((r, i) => (
        <button
          key={`row-${i}`}
          type="button"
          aria-label={`${i + 1}행 선택`}
          title="행 선택"
          className="wiki-table-pick wiki-table-pick-row"
          style={{ top: r.top, left: rect.left - 8, height: r.height }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => selectRow(editor, i)}
        />
      ))}
      {/* 우측: 열 추가(드래그로 여러 개) + 열 삭제 */}
      <div
        className="wiki-table-add wiki-table-add-col"
        style={{
          top: rect.top,
          left: rect.left + rect.width,
          height: rect.height,
          flexDirection: "column",
          gap: 4,
        }}
      >
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => resizeByDrag(e, "x", addColumn, shrinkColumn)}
          aria-label="열 추가 (드래그로 여러 개 추가/삭제)"
          title="열 추가 · 드래그로 여러 개 추가/삭제"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().deleteColumn().run()}
          aria-label="열 삭제"
          title="열 삭제"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {/* 하단: 행 추가(드래그로 여러 개) + 행 삭제 */}
      <div
        className="wiki-table-add wiki-table-add-row"
        style={{
          top: rect.top + rect.height,
          left: rect.left,
          width: rect.width,
          gap: 4,
        }}
      >
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => resizeByDrag(e, "y", addRow, shrinkRow)}
          aria-label="행 추가 (드래그로 여러 개 추가/삭제)"
          title="행 추가 · 드래그로 여러 개 추가/삭제"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().deleteRow().run()}
          aria-label="행 삭제"
          title="행 삭제"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </>
  );
}
