"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { WikiView } from "@/components/wiki/wiki-view";
import { cn } from "@/lib/utils";
import {
  getWikiRevisionAction,
  restoreWikiRevision,
} from "@/server/actions/wiki";

export type RevisionListItem = {
  id: string;
  title: string;
  createdAt: Date;
  editor: MiniUser | null;
};

type RevisionDetail = {
  id: string;
  title: string;
  content: unknown;
  createdAt: Date;
  editor: MiniUser | null;
};

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function asDoc(content: unknown): JSONContent {
  if (
    content &&
    typeof content === "object" &&
    "type" in content &&
    (content as { type?: string }).type === "doc"
  ) {
    return content as JSONContent;
  }
  return EMPTY_DOC;
}

/**
 * 버전 기록 다이얼로그. 좌측 리비전 목록(작성자·시각) → 선택 시 우측에 해당 버전의
 * 내용을 읽기전용(WikiView)으로 미리보기 + '이 버전으로 복원'. 복원은 현재를 스냅샷한
 * 뒤 되돌리므로 그 자체가 하나의 새 리비전이 된다.
 */
export function VersionHistory({
  revisions,
  open,
  onOpenChange,
}: {
  revisions: RevisionListItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RevisionDetail | null>(null);
  const [loading, startLoad] = useTransition();
  const [restoring, startRestore] = useTransition();

  // 닫을 때 이전 선택 상태를 초기화(다음에 열 때 깨끗한 상태로).
  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelectedId(null);
      setDetail(null);
    }
    onOpenChange(next);
  }

  function select(id: string) {
    setSelectedId(id);
    setDetail(null);
    startLoad(async () => {
      try {
        const d = await getWikiRevisionAction(id);
        if (d) setDetail(d as RevisionDetail);
      } catch {
        toast.error("버전을 불러오지 못했습니다");
      }
    });
  }

  function restore() {
    if (!selectedId) return;
    startRestore(async () => {
      try {
        await restoreWikiRevision(selectedId);
        toast.success("이 버전으로 복원했습니다");
        handleOpenChange(false);
        router.refresh();
      } catch {
        toast.error("복원에 실패했습니다");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[70vh] max-h-[640px] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            <History className="size-4" /> 버전 기록
          </DialogTitle>
          <DialogDescription>
            이전 버전을 선택해 내용을 확인하고 복원할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[10rem_1fr] gap-3 sm:grid-cols-[15rem_1fr] sm:grid-rows-1">
          {/* 좌측: 리비전 목록 */}
          <div className="min-h-0 rounded-lg border border-border bg-muted/30">
            {revisions.length === 0 ? (
              <p className="text-muted-foreground p-3 text-xs">
                아직 저장된 이전 버전이 없습니다.
              </p>
            ) : (
              <ScrollArea className="h-full">
                <ul className="flex flex-col p-1">
                  {revisions.map((rev) => (
                    <li key={rev.id}>
                      <button
                        type="button"
                        onClick={() => select(rev.id)}
                        className={cn(
                          "flex w-full flex-col items-start gap-1 rounded-md px-2 py-1.5 text-left text-sm",
                          selectedId === rev.id
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/60",
                        )}
                      >
                        <span className="truncate font-medium">
                          {rev.title || "제목 없음"}
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                          {rev.editor && (
                            <UserBadge user={rev.editor} size="xs" />
                          )}
                          <span>
                            {formatDistanceToNow(rev.createdAt, {
                              addSuffix: true,
                              locale: ko,
                            })}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>

          {/* 우측: 선택한 버전 미리보기 */}
          <div className="flex min-h-0 flex-col rounded-lg border border-border">
            {!selectedId ? (
              <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-center text-sm">
                왼쪽에서 버전을 선택하세요.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    {detail
                      ? `${formatDistanceToNow(detail.createdAt, {
                          addSuffix: true,
                          locale: ko,
                        })} 버전`
                      : "불러오는 중…"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={restore}
                    disabled={restoring || loading}
                  >
                    <RotateCcw className="size-3.5" />
                    {restoring ? "복원 중…" : "이 버전으로 복원"}
                  </Button>
                </div>
                <ScrollArea className="min-h-0 flex-1">
                  <div className="p-4">
                    {loading || !detail ? (
                      <p className="text-muted-foreground text-sm">
                        불러오는 중…
                      </p>
                    ) : (
                      <WikiView
                        title={detail.title}
                        content={asDoc(detail.content)}
                      />
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
