"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import { wikiExtensions } from "@/components/wiki/extensions";
import { cn } from "@/lib/utils";

/**
 * 위키 본문 읽기전용 렌더러. 에디터와 동일한 Tiptap 확장(wikiExtensions)으로
 * 파싱하되 editable=false + 툴바 없음. 뷰/편집 토글의 '뷰' 쪽이며, 버전 미리보기에도
 * 재사용한다. showTitle 로 제목 헤딩 노출 여부를 제어(미리보기는 제목 별도 표기).
 */
export function WikiView({
  title,
  content,
  showTitle = true,
  className,
}: {
  title?: string;
  content: JSONContent;
  showTitle?: boolean;
  className?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: wikiExtensions(),
    content,
    editorProps: {
      attributes: { class: "tiptap focus:outline-none" },
    },
  });

  // Tiptap useEditor 는 최초 content 만 반영하므로, content prop 이 바뀌면(버전
  // 미리보기 전환·router.refresh 등) 직접 반영한다. (gotchas §10)
  useEffect(() => {
    if (!editor) return;
    if (JSON.stringify(content) === JSON.stringify(editor.getJSON())) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  return (
    <div className={cn("mx-auto max-w-3xl", className)}>
      {showTitle && (
        <h1 className="mb-4 text-2xl font-semibold break-words md:text-3xl">
          {title?.trim() || "제목 없음"}
        </h1>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
