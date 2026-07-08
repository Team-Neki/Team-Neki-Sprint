"use client";

import { useState } from "react";
import { Eye, Pencil } from "lucide-react";
import type { JSONContent } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { WikiEditor } from "@/components/wiki/editor";
import { WikiCommentsView } from "@/components/wiki/wiki-comments-view";
import type { ThreadItem } from "@/components/wiki/comment-thread-card";
import { WikiPageMenu } from "@/components/wiki/wiki-page-menu";
import type { RevisionListItem } from "@/components/wiki/version-history";

/**
 * 위키 상세의 뷰/편집 전환 셸. 기본은 읽기전용 뷰(WikiCommentsView), 우측 상단 '편집'
 * 버튼으로 에디터(WikiEditor)로 토글한다. 편집은 명시적 '저장/취소'로 마치며(에디터 내부),
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
}) {
  // 임시저장본이 있으면 편집 모드로 바로 진입(사용자가 편집을 이어가도록).
  const [mode, setMode] = useState<"view" | "edit">(draft ? "edit" : "view");

  return (
    <div>
      {/* 상단 툴바: 스크롤을 내려도 '수정' 버튼이 보이도록 sticky 고정(main 스크롤 기준).
          불투명 배경으로 본문이 헤더 뒤로 비치지 않게 한다(main 스크롤 컨테이너의 top
          패딩 위 band 은 콘텐츠가 아니라 컨테이너 여백이라 별도 보정 불필요). */}
      <div className="bg-background sticky top-0 z-20 mb-4 border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 py-2">
          <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
            {editor && <UserBadge user={editor} size="xs" />}
            <span className="shrink-0">{updatedLabel}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant={mode === "edit" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setMode((m) => (m === "edit" ? "view" : "edit"))}
            >
              {mode === "edit" ? (
                <>
                  <Eye className="size-4" /> 보기
                </>
              ) : (
                <>
                  <Pencil className="size-4" /> 수정
                </>
              )}
            </Button>
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
          pageId={pageId}
          initialTitle={title}
          initialContent={content}
          draft={draft}
          onExit={() => setMode("view")}
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
