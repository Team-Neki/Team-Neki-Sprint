"use client";

// 공지 상세의 뷰/편집 전환 셸(위키 WikiDetail 과 동일 패턴). 기본은 읽기전용
// 뷰(WikiView), sticky 헤더의 '수정' 버튼으로 편집(AnnouncementEditor) 전환.
// 저장/취소는 헤더에서 핸들로 호출한다. 삭제는 작성자만(서버에서도 재검증).

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { Megaphone, Pencil, Trash2 } from "lucide-react";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { WikiView } from "@/components/wiki/wiki-view";
import {
  AnnouncementEditor,
  type AnnouncementEditorHandle,
  type AnnouncementEditorState,
} from "@/components/announcements/announcement-editor";
import { deleteAnnouncement } from "@/server/actions/announcements";

export function AnnouncementDetail({
  id,
  title,
  content,
  author,
  updatedLabel,
  canDelete,
  initialEdit,
}: {
  id: string;
  title: string;
  content: JSONContent;
  author: MiniUser | null;
  updatedLabel: string;
  /** 작성자 본인(또는 작성자 없는 공지의 ADMIN)만 true — 서버에서도 재검증한다. */
  canDelete: boolean;
  /** 방금 생성돼 편집부터 시작할지(?edit=1). */
  initialEdit: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">(
    initialEdit ? "edit" : "view",
  );
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
      {/* 위키 상세와 동일한 sticky 헤더(스크롤에도 수정/저장 버튼 고정). */}
      <div className="bg-background sticky top-0 z-20 mb-4 border-b before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-4 before:bg-background before:content-[''] sm:before:h-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 py-2">
          <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
            <Megaphone className="size-3.5 shrink-0" aria-hidden />
            <span className="shrink-0 font-medium">공지</span>
            {author && <UserBadge user={author} size="xs" />}
            <span className="shrink-0">{updatedLabel}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {mode === "view" ? (
              <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                <Pencil className="size-4" /> 수정
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editorRef.current?.cancel()}
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
              </>
            )}
            {canDelete && (
              <ConfirmDelete
                title="공지를 삭제하시겠어요?"
                description="이 작업은 되돌릴 수 없습니다."
                onConfirm={() => deleteAnnouncement(id)}
                redirectTo="/dashboard"
                trigger={
                  <Button variant="ghost" size="sm" aria-label="공지 삭제">
                    <Trash2 className="size-4" />
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </div>

      {mode === "edit" ? (
        <AnnouncementEditor
          key={id}
          ref={editorRef}
          id={id}
          initialTitle={title}
          initialContent={content}
          onExit={() => {
            setMode("view");
            // ?edit=1 로 진입한 경우 URL 을 정리해 새로고침 시 뷰 모드가 되게 한다.
            router.replace(`/announcements/${id}`);
          }}
          onStateChange={handleEditState}
        />
      ) : (
        <WikiView title={title} content={content} />
      )}
    </div>
  );
}
