"use client";

import { useState } from "react";
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Check, Copy } from "lucide-react";

/**
 * 코드블록 언어 옵션(구문 강조). 값은 highlight.js 언어 id — lowlight `common`
 * 세트에 모두 포함돼 있어 별도 등록 없이 하이라이트된다. "ios" 는 Swift 로 매핑.
 */
const LANGUAGES: { value: string; label: string }[] = [
  { value: "", label: "Plain" },
  { value: "bash", label: "Bash" },
  { value: "kotlin", label: "Kotlin" },
  { value: "java", label: "Java" },
  { value: "json", label: "JSON" },
  { value: "yaml", label: "YAML" },
  { value: "swift", label: "iOS (Swift)" },
];

/**
 * 코드블록 NodeView. CodeBlockLowlight(구문강조) 위에 우측 상단 도구(언어 선택 +
 * 복사 버튼)를 얹는다. 편집/읽기 뷰 공유(wikiExtensions) — 코드 본문은 NodeViewContent
 * (as="code")가 담아 lowlight 데코레이션이 그대로 적용된다.
 *
 * - 언어 선택(편집 모드): node.attrs.language 를 바꿔 하이라이트 언어를 지정한다.
 *   읽기 모드에선 지정된 언어 라벨만 표시. 목록에 없는 기존 언어값도 옵션으로 보존.
 * - 복사: node.textContent 를 클립보드로.
 */
function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const language = (node.attrs.language as string | null) ?? "";

  // 현재 언어가 목록에 없으면(예: ``` 로 지정된 javascript) 옵션으로 덧붙여 보존.
  const options = LANGUAGES.some((l) => l.value === language)
    ? LANGUAGES
    : [{ value: language, label: language }, ...LANGUAGES];
  const currentLabel =
    options.find((l) => l.value === language)?.label ?? language;

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
      <div className="wiki-codeblock-tools" contentEditable={false}>
        {editor.isEditable ? (
          <select
            className="wiki-codeblock-lang"
            value={language}
            onChange={(e) =>
              updateAttributes({ language: e.target.value || null })
            }
            aria-label="코드 언어"
          >
            {options.map((l) => (
              <option key={l.value || "plain"} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        ) : (
          language && (
            <span className="wiki-codeblock-lang-label">{currentLabel}</span>
          )
        )}
        <button
          type="button"
          onClick={copy}
          className="wiki-codeblock-copy"
          aria-label="코드 복사"
          title="코드 복사"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      <pre>
        {/* NodeViewContent 의 as 는 NoInfer 제네릭이라 타입 인자를 명시해야 code 로 렌더된다. */}
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

export { CodeBlockView };
