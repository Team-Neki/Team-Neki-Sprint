"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, History, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  VersionHistory,
  type RevisionListItem,
} from "@/components/wiki/version-history";
import {
  toggleWikiFavorite,
  deleteWikiPage,
  restoreWikiPage,
} from "@/server/actions/wiki";

/**
 * 위키 상세 우측 상단 ⋯ 메뉴: 버전 기록 · 별표 토글 · 삭제.
 * 다이얼로그(버전 기록/삭제 확인)는 메뉴 항목 클릭으로 열리도록 controlled 로 둔다.
 */
export function WikiPageMenu({
  pageId,
  favorited,
  revisions,
  deleteDescription,
}: {
  pageId: string;
  favorited: boolean;
  revisions: RevisionListItem[];
  deleteDescription: string;
}) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, start] = useTransition();

  function toggleStar() {
    start(async () => {
      try {
        const { favorited: next } = await toggleWikiFavorite(pageId);
        toast.success(next ? "별표에 추가했습니다" : "별표를 해제했습니다");
        router.refresh();
      } catch {
        toast.error("별표 변경에 실패했습니다");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="더보기">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
            <History className="size-4" /> 버전 기록
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleStar} disabled={pending}>
            <Star
              className={
                favorited ? "size-4 fill-amber-400 text-amber-400" : "size-4"
              }
            />
            {favorited ? "별표 해제" : "별표"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" /> 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <VersionHistory
        revisions={revisions}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />

      <ConfirmDelete
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deleteWikiPage(pageId)}
        undo={() => restoreWikiPage(pageId)}
        redirectTo="/wiki"
        title="이 페이지를 삭제할까요?"
        description={deleteDescription}
      />
    </>
  );
}
