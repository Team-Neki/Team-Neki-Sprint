"use client";

import { useEffect, useRef, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Pencil, Eye } from "lucide-react";

const DEFAULT_CODE = "flowchart TD\n  A[시작] --> B[끝]";

/**
 * mermaid 다이어그램 블록(atom 노드). 소스는 노드 attrs.code 에 문자열로 저장하고,
 * 렌더는 NodeView 에서 mermaid 를 동적 import(무거운 번들이라 지연 로드) 해 SVG 로 그린다.
 * 에디터(편집 가능)에선 '편집' 토글로 코드 textarea 를 열어 실시간 미리보기, 읽기전용
 * 뷰(WikiView·WikiCommentsView)에선 다이어그램만 보여준다(확장을 공유하므로 자동).
 */
function MermaidView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const code = (node.attrs.code as string) ?? "";
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    // setState 는 effect 본문이 아니라 async 콜백 안에서만(react-hooks/set-state-in-effect).
    (async () => {
      if (!code.trim()) {
        host.innerHTML = "";
        if (!cancelled) setError(null);
        return;
      }
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "strict",
          fontFamily: "inherit",
        });
        // 렌더마다 고유 id(mermaid 가 임시 노드를 그 id 로 body 에 붙였다 지운다).
        seq.current += 1;
        const id = `wiki-mermaid-${seq.current}-${Math.floor(performance.now())}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled) {
          host.innerHTML = svg;
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          host.innerHTML = "";
          setError(
            e instanceof Error ? e.message : "다이어그램을 그릴 수 없습니다",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <NodeViewWrapper
      className="wiki-mermaid"
      data-selected={selected ? "" : undefined}
    >
      {editor.isEditable && (
        <div className="wiki-mermaid-bar" contentEditable={false}>
          <span className="wiki-mermaid-label">다이어그램</span>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-label={editing ? "미리보기" : "코드 편집"}
            title={editing ? "미리보기" : "코드 편집"}
          >
            {editing ? (
              <Eye className="size-3.5" />
            ) : (
              <Pencil className="size-3.5" />
            )}
            {editing ? "미리보기" : "편집"}
          </button>
        </div>
      )}

      {editor.isEditable && editing && (
        <textarea
          className="wiki-mermaid-code"
          value={code}
          onChange={(e) => updateAttributes({ code: e.target.value })}
          spellCheck={false}
          rows={Math.max(3, code.split("\n").length + 1)}
          placeholder="mermaid 문법 (예: flowchart TD; A --> B)"
        />
      )}

      <div className="wiki-mermaid-diagram" ref={hostRef} />
      {error && (
        <pre className="wiki-mermaid-error" contentEditable={false}>
          {error}
        </pre>
      )}
    </NodeViewWrapper>
  );
}

export const MermaidBlock = Node.create({
  name: "mermaidBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      code: {
        default: DEFAULT_CODE,
        parseHTML: (el) =>
          el.getAttribute("data-code") ?? el.textContent ?? "",
        renderHTML: (attrs) => ({ "data-code": attrs.code as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-mermaid]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    // 저장/복붙 폴백: data-mermaid 컨테이너 + 원본 코드를 텍스트로 보존.
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-mermaid": "" }),
      node.attrs.code as string,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidView);
  },
});
