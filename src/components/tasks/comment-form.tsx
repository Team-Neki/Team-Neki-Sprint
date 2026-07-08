"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  RichEditor,
  editorContentString,
} from "@/components/rich-text/rich-editor";
import { addComment } from "@/server/actions/tasks";

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export function CommentForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const editorRef = useRef<Editor | null>(null);
  const [empty, setEmpty] = useState(true);
  const [pending, start] = useTransition();

  function submit() {
    const editor = editorRef.current;
    if (!editor || editor.isEmpty) return;
    const body = editorContentString(editor);
    start(async () => {
      try {
        await addComment(taskId, body);
        editor.commands.clearContent();
        setEmpty(true);
        router.refresh();
      } catch {
        toast.error("댓글 등록에 실패했습니다");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="focus-within:border-ring rounded-md border px-3 py-2">
        <RichEditor
          initialContent={EMPTY_DOC}
          placeholder="댓글을 남겨보세요… (#티켓, @사람)"
          onEditor={(e) => (editorRef.current = e)}
          onUpdate={(e) => setEmpty(e.isEmpty)}
          onSubmitShortcut={submit}
        />
      </div>
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={pending || empty}>
          {pending ? "등록 중…" : "댓글 등록"}
        </Button>
      </div>
    </div>
  );
}
