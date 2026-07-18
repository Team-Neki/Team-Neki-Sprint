"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { NodeSelection } from "@tiptap/pm/state";
import { GripVertical, Copy, Trash2 } from "lucide-react";

/**
 * 노션식 줄(블록) 핸들. hover 한 최상위 블록 좌측에 ⋮⋮ 버튼을 띄운다
 * (@tiptap/extension-drag-handle-react — 위치 추적/드래그 이동 내장).
 * - 드래그: 블록 순서 이동(확장 내장)
 * - 클릭: 해당 블록 NodeSelection(줄 선택) + 블록 메뉴(복제·삭제)
 * 편집 모드 전용 — WikiEditor 에서만 렌더한다(읽기전용 뷰엔 없음).
 */
export function BlockHandle({ editor }: { editor: Editor }) {
  // onNodeChange 로 받은 현재 hover 블록 위치. 메뉴 액션이 이 pos 기준으로 동작.
  const posRef = useRef<number>(-1);
  const [menuOpen, setMenuOpen] = useState(false);

  function currentPos(): number | null {
    const pos = posRef.current;
    if (pos < 0 || pos > editor.state.doc.content.size) return null;
    return pos;
  }

  /** 핸들 클릭 = 블록 전체 선택(줄 선택) + 메뉴 토글. */
  function selectBlock() {
    const pos = currentPos();
    if (pos == null) return;
    try {
      const sel = NodeSelection.create(editor.state.doc, pos);
      editor.view.dispatch(editor.state.tr.setSelection(sel));
    } catch {
      return; // 선택 불가 노드(스키마상 selectable=false)면 메뉴만 연다.
    }
    setMenuOpen((v) => !v);
  }

  function duplicateBlock() {
    const pos = currentPos();
    if (pos == null) return;
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize, node.toJSON())
      .run();
    setMenuOpen(false);
  }

  function deleteBlock() {
    const pos = currentPos();
    if (pos == null) return;
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .run();
    setMenuOpen(false);
  }

  return (
    <DragHandle
      editor={editor}
      className="wiki-block-handle"
      onNodeChange={({ pos }) => {
        // 다른 블록으로 이동하면 열린 메뉴를 닫는다(엉뚱한 블록에 액션 방지).
        if (pos !== posRef.current) setMenuOpen(false);
        posRef.current = pos;
      }}
    >
      <div className="relative" contentEditable={false}>
        <button
          type="button"
          aria-label="블록 선택 (드래그로 이동)"
          title="클릭: 블록 선택 · 드래그: 이동"
          className="wiki-block-handle-btn"
          onClick={selectBlock}
        >
          <GripVertical className="size-4" />
        </button>
        {menuOpen && (
          <div className="wiki-block-menu" role="menu">
            <button type="button" role="menuitem" onClick={duplicateBlock}>
              <Copy className="size-3.5" /> 복제
            </button>
            <button
              type="button"
              role="menuitem"
              data-danger=""
              onClick={deleteBlock}
            >
              <Trash2 className="size-3.5" /> 삭제
            </button>
          </div>
        )}
      </div>
    </DragHandle>
  );
}
