"use client";

// 표 우클릭 컨텍스트 메뉴(T22). 셀에서 우클릭하면 열/행 추가·삭제 메뉴를 띄운다.
// - 일반 셀 우클릭: 좌/우 열 추가 · 위/아래 행 추가 · 열/행 삭제 (우클릭한 셀 기준)
// - 드래그로 "행 전체" 선택 후 우클릭: 위/아래 행 추가 · 행 삭제 (선택 유지)
// - 드래그로 "열 전체" 선택 후 우클릭: 좌/우 열 추가 · 열 삭제 (선택 유지)
// TableHoverControls 처럼 컨테이너 좌표계에 절대배치 오버레이로 그린다.

import { useEffect, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection, selectedRect } from "@tiptap/pm/tables";
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Trash2,
} from "lucide-react";

type MenuKind = "cell" | "row" | "col";
type MenuState = { x: number; y: number; kind: MenuKind };

const MENU_WIDTH = 176; // w-44

export function TableContextMenu({
  editor,
  containerRef,
}: {
  editor: Editor;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    const dom = editor.view.dom;

    function onContextMenu(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      const cell = target?.closest("td,th");
      const container = containerRef.current;
      if (!cell || !dom.contains(cell) || !container) return;
      e.preventDefault();

      let kind: MenuKind = "cell";
      const sel = editor.state.selection;
      if (sel instanceof CellSelection) {
        // 드래그로 행/열 전체를 선택한 채 우클릭 → 선택을 유지하고 전용 메뉴.
        // (전체 표 선택 등 그 외 셀 선택은 일반 셀 메뉴로 취급)
        const rect = selectedRect(editor.state);
        const fullWidth = rect.left === 0 && rect.right === rect.map.width;
        const fullHeight = rect.top === 0 && rect.bottom === rect.map.height;
        if (fullWidth && !fullHeight) kind = "row";
        else if (fullHeight && !fullWidth) kind = "col";
      } else {
        // 우클릭한 셀에 커서를 놓아 이후 명령이 그 셀 기준으로 동작하게 한다.
        const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
        if (pos) {
          const tr = editor.state.tr.setSelection(
            TextSelection.near(editor.state.doc.resolve(pos.pos)),
          );
          editor.view.dispatch(tr);
        }
      }

      const cr = container.getBoundingClientRect();
      setMenu({
        x: Math.min(e.clientX - cr.left, cr.width - MENU_WIDTH),
        y: e.clientY - cr.top,
        kind,
      });
    }

    dom.addEventListener("contextmenu", onContextMenu);
    return () => dom.removeEventListener("contextmenu", onContextMenu);
  }, [editor, containerRef]);

  useEffect(() => {
    if (!menu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  if (!menu) return null;

  const run = (command: () => boolean) => () => {
    setMenu(null);
    command();
  };
  const chain = () => editor.chain().focus();

  const colItems = (
    <>
      <MenuItem
        icon={<ArrowLeftToLine className="size-3.5" />}
        onClick={run(() => chain().addColumnBefore().run())}
      >
        왼쪽에 열 추가
      </MenuItem>
      <MenuItem
        icon={<ArrowRightToLine className="size-3.5" />}
        onClick={run(() => chain().addColumnAfter().run())}
      >
        오른쪽에 열 추가
      </MenuItem>
    </>
  );
  const rowItems = (
    <>
      <MenuItem
        icon={<ArrowUpToLine className="size-3.5" />}
        onClick={run(() => chain().addRowBefore().run())}
      >
        위에 행 추가
      </MenuItem>
      <MenuItem
        icon={<ArrowDownToLine className="size-3.5" />}
        onClick={run(() => chain().addRowAfter().run())}
      >
        아래에 행 추가
      </MenuItem>
    </>
  );

  return (
    <>
      {/* 바깥 클릭으로 닫는 투명 백드롭(다른 우클릭도 흡수해 닫는다). */}
      <div
        className="fixed inset-0 z-40"
        onMouseDown={() => setMenu(null)}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu(null);
        }}
      />
      <div
        className="bg-popover text-popover-foreground ring-foreground/10 absolute z-50 w-44 rounded-lg p-1 shadow-md ring-1"
        style={{ top: menu.y, left: menu.x }}
        role="menu"
      >
        {menu.kind !== "row" && colItems}
        {menu.kind !== "col" && rowItems}
        <div className="bg-border my-1 h-px" role="separator" />
        {menu.kind !== "row" && (
          <MenuItem
            icon={<Trash2 className="size-3.5" />}
            onClick={run(() => chain().deleteColumn().run())}
          >
            열 삭제
          </MenuItem>
        )}
        {menu.kind !== "col" && (
          <MenuItem
            icon={<Trash2 className="size-3.5" />}
            onClick={run(() => chain().deleteRow().run())}
          >
            행 삭제
          </MenuItem>
        )}
      </div>
    </>
  );
}

function MenuItem({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      // mousedown 에서 실행: click 을 기다리면 백드롭 mousedown 이 먼저 메뉴를 닫는다.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
    >
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </button>
  );
}
