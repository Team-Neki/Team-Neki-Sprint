"use client";

import { useState } from "react";
import { Eye, Pencil } from "lucide-react";
import type { JSONContent } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { WikiEditor } from "@/components/wiki/editor";
import { WikiView } from "@/components/wiki/wiki-view";
import { WikiPageMenu } from "@/components/wiki/wiki-page-menu";
import {
  PageFolderSelect,
  type FolderOption,
} from "@/components/wiki/page-folder-select";
import type { RevisionListItem } from "@/components/wiki/version-history";

/**
 * 위키 상세의 뷰/편집 전환 셸. 기본은 읽기전용 뷰(WikiView), 우측 상단 '편집' 버튼으로
 * 에디터(WikiEditor)로 토글한다. 에디터는 기존 자동저장→리비전 로직을 그대로 쓰며,
 * 저장 시 router.refresh 로 서버 데이터가 갱신되어 뷰로 돌아오면 최신 내용이 보인다.
 */
export function WikiDetail({
  pageId,
  title,
  content,
  editor,
  updatedLabel,
  folderId,
  folders,
  favorited,
  revisions,
  deleteDescription,
}: {
  pageId: string;
  title: string;
  content: JSONContent;
  editor: MiniUser | null;
  updatedLabel: string;
  folderId: string | null;
  folders: FolderOption[];
  favorited: boolean;
  revisions: RevisionListItem[];
  deleteDescription: string;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");

  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between gap-2">
        <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
          {editor && <UserBadge user={editor} size="xs" />}
          <span className="shrink-0">{updatedLabel}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <PageFolderSelect
            pageId={pageId}
            folderId={folderId}
            folders={folders}
          />
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
        />
      ) : (
        <WikiView title={title} content={content} />
      )}
    </div>
  );
}
