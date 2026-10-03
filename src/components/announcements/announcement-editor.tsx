"use client";

// 공지 편집기. 위키 에디터의 구성요소(useWikiEditor·Toolbar·TableHoverControls)를
// 그대로 재사용하되(첨부·붙여넣기·드롭·트리플클릭도 같은 훅), 위키의 임시저장본
// (WikiDraft) 시스템은 없다 — 공지는 짧은 글이라 명시적 저장/취소만 둔다. 저장/취소 버튼은 상세(announcement-detail)의 sticky
// 헤더에서 핸들(commit/cancel)로 호출한다(위키와 동일 패턴).

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { EditorContent, type JSONContent } from "@tiptap/react";
import { toast } from "sonner";
import { Toolbar, TableHoverControls } from "@/components/wiki/editor";
import {
  useSaveShortcuts,
  useWikiEditor,
} from "@/components/wiki/use-wiki-editor";
import { TableContextMenu } from "@/components/wiki/table-context-menu";
import { Input } from "@/components/ui/input";
import {
  createAnnouncement,
  updateAnnouncement,
} from "@/server/actions/announcements";

export type AnnouncementEditorHandle = {
  commit: () => void;
  cancel: () => void;
};

export type AnnouncementEditorState = { saving: boolean };

type AnnouncementEditorProps = {
  /** 없으면 생성 모드 — 저장 시 createAnnouncement 로 새로 만들고 상세로 이동한다. */
  id?: string;
  initialTitle: string;
  initialContent: JSONContent;
  /** 저장/취소로 편집을 마칠 때 호출(뷰 모드로 복귀). */
  onExit?: () => void;
  /** 저장 상태를 부모(헤더)로 올려 버튼 비활성에 사용. */
  onStateChange?: (state: AnnouncementEditorState) => void;
};

export const AnnouncementEditor = forwardRef<
  AnnouncementEditorHandle,
  AnnouncementEditorProps
>(function AnnouncementEditor(
  { id, initialTitle, initialContent, onExit, onStateChange },
  ref,
) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  // state 는 리렌더 전 연속 호출(더블클릭·Cmd+S 키 반복)을 못 막는다 — ref 로 동기 가드.
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  const editorAreaRef = useRef<HTMLDivElement>(null);

  const editor = useWikiEditor({
    content: initialContent,
    placeholder: "공지 내용을 입력하세요…",
    onUpdate: () => {
      dirtyRef.current = true;
    },
  });

  // getJSON() 은 순수 JSON 으로 클론해 서버 액션에 넘긴다(RSC 직렬화, gotchas §7).
  const cloneContent = useCallback(() => {
    if (!editor) return null;
    return JSON.parse(JSON.stringify(editor.getJSON()));
  }, [editor]);

  const commit = useCallback(async () => {
    if (savingRef.current) return;
    const content = cloneContent();
    if (!content) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (id) {
        await updateAnnouncement(id, title, content);
        dirtyRef.current = false;
        router.refresh();
        onExit?.();
      } else {
        // 생성 모드: 저장을 눌러야 비로소 DB 에 공지를 만든다(취소 시 아무것도 안 남음).
        const { id: newId } = await createAnnouncement(title, content);
        dirtyRef.current = false;
        router.replace(`/announcements/${newId}`);
      }
    } catch {
      toast.error("공지 저장에 실패했습니다");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [cloneContent, id, title, router, onExit]);

  const cancel = useCallback(() => {
    dirtyRef.current = false;
    router.refresh();
    onExit?.();
  }, [router, onExit]);

  useImperativeHandle(ref, () => ({ commit, cancel }), [commit, cancel]);

  useEffect(() => {
    onStateChange?.({ saving });
  }, [saving, onStateChange]);

  // Cmd/Ctrl+S·Cmd/Ctrl+Enter 저장 + 저장 전 이탈 경고(공지는 draft 자동저장이 없다).
  useSaveShortcuts(commit, dirtyRef);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            dirtyRef.current = true;
          }}
          placeholder="공지 제목"
          className="border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-3xl"
        />
      </div>

      {editor && <Toolbar editor={editor} />}

      <div ref={editorAreaRef} className="relative mt-4">
        <EditorContent editor={editor} />
        {editor && (
          <>
            <TableHoverControls editor={editor} containerRef={editorAreaRef} />
            <TableContextMenu editor={editor} containerRef={editorAreaRef} />
          </>
        )}
      </div>
    </div>
  );
});
