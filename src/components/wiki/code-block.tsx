"use client";

import { useState } from "react";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Check, Copy } from "lucide-react";

/**
 * 코드블록 NodeView. CodeBlockLowlight(구문강조) 위에 우측 상단 복사 버튼을 얹는다.
 * 편집/읽기 뷰 공유(wikiExtensions) — 읽기 뷰에서도 렌더된 코드블록에 hover 하면
 * 복사 버튼이 뜬다. 코드 본문은 NodeViewContent(as="code")가 담아 lowlight 데코레이션이
 * 그대로 적용된다. 복사 대상은 노드 텍스트(node.textContent).
 */
function CodeBlockView({ node }: NodeViewProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 접근 실패(권한/비보안 컨텍스트) 시 조용히 무시.
    }
  }

  return (
    <NodeViewWrapper className="wiki-codeblock">
      <button
        type="button"
        contentEditable={false}
        onClick={copy}
        className="wiki-codeblock-copy"
        aria-label="코드 복사"
        title="코드 복사"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "복사됨" : "복사"}
      </button>
      <pre>
        {/* NodeViewContent 의 as 는 NoInfer 제네릭이라 타입 인자를 명시해야 code 로 렌더된다. */}
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

export { CodeBlockView };
