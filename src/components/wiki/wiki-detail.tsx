"use client";

import { useCallback, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { Pencil } from "lucide-react";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { Button } from "@/components/ui/button";
import {
  WikiEditor,
  type WikiEditorHandle,
  type WikiEditorState,
} from "@/components/wiki/editor";
import { WikiCommentsView } from "@/components/wiki/wiki-comments-view";
import type { ThreadItem } from "@/components/wiki/comment-thread-card";
import { WikiPageMenu } from "@/components/wiki/wiki-page-menu";
import type { RevisionListItem } from "@/components/wiki/version-history";

/**
 * 위키 상세의 뷰/편집 전환 셸. 기본은 읽기전용 뷰(WikiCommentsView), 제목 행 우측의 '수정'
 * 버튼으로 에디터(WikiEditor)로 전환한다. 편집은 명시적 '저장/취소'로만 마치며(에디터 내부),
 * onExit 으로 뷰 모드로 복귀한다. 편집 중 변경은 임시저장본(WikiDraft)에 자동저장된다.
 */
export function WikiDetail({
  pageId,
  title,
  content,
  editor,
  updatedLabel,
  updatedAt,
  favorited,
  revisions,
  deleteDescription,
  threads,
  currentUserId,
  draft,
  startInEdit = false,
}: {
  pageId: string;
  title: string;
  content: JSONContent;
  editor: MiniUser | null;
  updatedLabel: string;
  updatedAt: string;
  favorited: boolean;
  revisions: RevisionListItem[];
  deleteDescription: string;
  threads: ThreadItem[];
  currentUserId: string;
  draft: { title: string; content: JSONContent } | null;
  /** 생성 직후(?edit=1) 편집 모드로 시작 + 제목 인풋 포커스. */
  startInEdit?: boolean;
}) {
  // 임시저장본이 있거나 생성 직후(?edit=1)면 편집 모드로 바로 진입.
  const [mode, setMode] = useState<"view" | "edit">(
    draft || startInEdit ? "edit" : "view",
  );
  // 저장/취소는 에디터가 아니라 이 sticky 헤더에서 호출한다(긴 본문 스크롤 시에도 고정).
  const editorRef = useRef<WikiEditorHandle>(null);
  const [editState, setEditState] = useState<WikiEditorState>({
    status: "",
    saving: false,
  });
  const handleEditState = useCallback(
    (s: WikiEditorState) => setEditState(s),
    [],
  );

  return (
    <div>
      {/* 상단 툴바: 스크롤을 내려도 '수정' 버튼이 보이도록 sticky 고정(main 스크롤 기준).
          main(overflow-auto)의 top 패딩 영역엔 스크롤된 본문이 비쳐 보이는데, sticky 헤더는
          그 아래(top:0)에 고정돼 헤더 위 패딩 band 으로 본문이 노출된다. 헤더와 함께 움직이는
          ::before 로 그 band(=main top 패딩 높이 pt-4/pt-6)을 불투명 배경으로 덮어 가린다. */}
      <div className="bg-background sticky top-0 z-20 mb-4 border-b before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-4 before:bg-background before:content-[''] sm:before:h-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 py-2">
          <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
            {editor && <UserBadge user={editor} size="xs" />}
            <span className="shrink-0">{updatedLabel}</span>
          </div>
          {/* '...' 메뉴 좌측: 뷰 모드는 '수정', 편집 중엔 상태·취소·저장(에디터 내부 아님). */}
          <div className="flex shrink-0 items-center gap-2">
            {mode === "view" ? (
              <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                <Pencil className="size-4" /> 수정
              </Button>
            ) : (
              <>
                {editState.status && (
                  <span className="text-muted-foreground hidden text-xs sm:inline">
                    {editState.status}
                  </span>
                )}
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
            <WikiPageMenu
              pageId={pageId}
              favorited={favorited}
              revisions={revisions}
              deleteDescription={deleteDescription}
            />
          </div>
        </div>
      </div>

      {mode === "edit" ? (
        <WikiEditor
          key={pageId}
          ref={editorRef}
          pageId={pageId}
          initialTitle={title}
          initialContent={content}
          draft={draft}
          autoFocusTitle={startInEdit}
          onExit={() => {
            setMode("view");
            // 생성 직후 진입 파라미터(?edit=1)를 URL 에서 제거 — 남겨두면
            // 새로고침 때마다 편집 모드로 재진입한다. 내비게이션 없이 URL 만 교체.
            if (startInEdit) {
              window.history.replaceState(null, "", `/wiki/${pageId}`);
            }
          }}
          onStateChange={handleEditState}
        />
      ) : (
        <WikiCommentsView
          pageId={pageId}
          title={title}
          content={content}
          threads={threads}
          currentUserId={currentUserId}
          updatedAt={updatedAt}
        />
      )}
    </div>
  );
}
