"use client";

import { useRef } from "react";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import {
  RichEditor,
  editorContentString,
} from "@/components/rich-text/rich-editor";
import { parseDoc } from "@/lib/rich-content";
import { useFieldSave, type DetailEntity } from "@/components/detail/use-field-save";

/**
 * 설명(인라인 리치 에디터, B6). 위키 에디터 번들(ProseMirror·lowlight·TableKit)을 끌어오므로
 * inline-fields.tsx 와 분리해 둔다 — 목록 컬럼이 inline-fields 를 import 해도 이 번들은 안 딸려온다.
 */
export function InlineDescription({
  type,
  id,
  value,
}: {
  type: DetailEntity;
  id: string;
  value: string | null;
}) {
  const { save } = useFieldSave(type, id);
  // 에디터가 만들어내는 정규화된 초기 내용을 기준으로 삼아 blur 시 실변경만 저장.
  const baseline = useRef<string | null>(null);
  const editorRef = useRef<Editor | null>(null);

  // 실변경만 저장. explicit(Cmd/Ctrl+Enter)이면 저장 여부를 토스트로 알린다.
  function commit(editor: Editor, explicit = false) {
    const next = editorContentString(editor);
    if (next !== baseline.current) {
      baseline.current = next;
      save({ description: next });
      if (explicit) toast.success("저장했습니다");
    } else if (explicit) {
      toast("변경사항이 없습니다");
    }
  }

  return (
    <div className="focus-within:border-ring hover:border-input rounded-md border border-transparent px-2 py-1 transition-colors">
      <RichEditor
        initialContent={parseDoc(value)}
        placeholder="설명을 입력하세요… (#티켓, @사람, ⌘+Enter 저장)"
        onEditor={(editor) => {
          editorRef.current = editor;
          if (editor && baseline.current === null) {
            baseline.current = editorContentString(editor);
          }
        }}
        onBlur={(editor) => commit(editor)}
        // Cmd/Ctrl+Enter: 즉시 저장 + blur 로 편집 종료 피드백(문서 에디터와 동일 제스처).
        onSubmitShortcut={() => {
          const editor = editorRef.current;
          if (!editor) return;
          commit(editor, true);
          editor.commands.blur();
        }}
      />
    </div>
  );
}
