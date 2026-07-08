"use client";

// 설명·댓글용 리치 텍스트 입력/표시(B6). 위키 에디터 확장(wikiExtensions)을 그대로
// 재사용해 '#' 티켓 링크 · '@' 사람 멘션 · 마크다운 입력규칙을 공유한다. 스타일은
// 위키 본문(.tiptap)을 쓰되 .tiptap-compact 로 최소높이·여백만 줄인다.

import { useEffect } from "react";
import {
  EditorContent,
  useEditor,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import { wikiExtensions } from "@/components/wiki/extensions";
import { parseDoc } from "@/lib/rich-content";
import { cn } from "@/lib/utils";

export function RichEditor({
  initialContent,
  placeholder,
  autoFocus,
  onBlur,
  onEditor,
  onUpdate,
  onSubmitShortcut,
  className,
}: {
  initialContent: JSONContent;
  placeholder?: string;
  autoFocus?: boolean;
  onBlur?: (editor: Editor) => void;
  onEditor?: (editor: Editor | null) => void;
  onUpdate?: (editor: Editor) => void;
  onSubmitShortcut?: () => void;
  className?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: wikiExtensions({ placeholder }),
    content: initialContent,
    autofocus: autoFocus ? "end" : false,
    onUpdate: onUpdate ? ({ editor }) => onUpdate(editor) : undefined,
    editorProps: {
      attributes: {
        class: cn("tiptap tiptap-compact focus:outline-none", className),
      },
      // Cmd/Ctrl+Enter 제출(멘션 드롭다운의 일반 Enter 선택과 겹치지 않음).
      handleKeyDown: onSubmitShortcut
        ? (_view, event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              onSubmitShortcut();
              return true;
            }
            return false;
          }
        : undefined,
    },
    onBlur: onBlur ? ({ editor }) => onBlur(editor) : undefined,
  });

  useEffect(() => {
    onEditor?.(editor ?? null);
  }, [editor, onEditor]);

  return <EditorContent editor={editor} />;
}

/** 읽기전용 표시(댓글 등). 저장 문자열(JSON/레거시 plain)을 파싱해 렌더. */
export function RichContent({
  value,
  className,
}: {
  value: string | null;
  className?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: wikiExtensions(),
    content: parseDoc(value),
    editorProps: {
      attributes: { class: cn("tiptap tiptap-compact", className) },
    },
  });

  return <EditorContent editor={editor} />;
}

/** 순수 JSON 클론(서버 액션 인자로 안전하게 넘기기 위함 — RSC 직렬화 이슈 회피). */
export function editorContentString(editor: Editor): string {
  return JSON.stringify(JSON.parse(JSON.stringify(editor.getJSON())));
}
