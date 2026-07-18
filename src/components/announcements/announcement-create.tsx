"use client";

// 새 공지 작성 셸(/announcements/new). AnnouncementDetail 의 편집 상태만 떼어낸 형태 —
// 저장을 눌러야 createAnnouncement 가 호출돼 공지가 생성되고 상세로 이동한다. 취소는
// 아무것도 만들지 않고 목록으로 돌아간다(빈 공지가 남던 문제 해결).

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AnnouncementEditor,
  type AnnouncementEditorHandle,
  type AnnouncementEditorState,
} from "@/components/announcements/announcement-editor";

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function AnnouncementCreate() {
  const router = useRouter();
  const editorRef = useRef<AnnouncementEditorHandle>(null);
  const [editState, setEditState] = useState<AnnouncementEditorState>({
    saving: false,
  });
  const handleEditState = useCallback(
    (s: AnnouncementEditorState) => setEditState(s),
    [],
  );

  return (
    <div>
      {/* 상세와 동일한 sticky 헤더(스크롤에도 저장/취소 고정). 생성 모드라 수정/삭제는 없다. */}
      <div className="bg-background sticky top-0 z-20 mb-4 border-b before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-4 before:bg-background before:content-[''] sm:before:h-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 py-2">
          <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
            <Megaphone className="size-3.5 shrink-0" aria-hidden />
            <span className="shrink-0 font-medium">새 공지</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/announcements")}
              disabled={editState.saving}
            >
              취소
            </Button>
            <Button
              size="sm"
              onClick={() => editorRef.current?.commit()}
              disabled={editState.saving}
            >
              저장
            </Button>
          </div>
        </div>
      </div>

      {/* id 없음 = 생성 모드. 저장 시 createAnnouncement → 새 상세로 replace. */}
      <AnnouncementEditor
        ref={editorRef}
        initialTitle=""
        initialContent={EMPTY_DOC}
        onStateChange={handleEditState}
      />
    </div>
  );
}
