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
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-2">
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
                <Pencil className="size-4" /> 편집
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
        />
      )}
    </div>
  );
}
