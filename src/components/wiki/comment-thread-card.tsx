"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Check, RotateCcw, Trash2, CornerDownLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { cn } from "@/lib/utils";
import {
  addWikiCommentReply,
  resolveWikiCommentThread,
  deleteWikiComment,
} from "@/server/actions/wiki-comments";

export type CommentItem = {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  author: MiniUser;
};

export type ThreadItem = {
  id: string;
  quote: string;
  resolved: boolean;
  createdAt: Date;
  comments: CommentItem[];
};

/**
 * 인라인 댓글 스레드 카드(우측 패널의 항목). 앵커 인용문 + 댓글 목록 + 답글 입력 +
 * 해결/재오픈·삭제. 스레드 전체 삭제는 앵커 마크 제거가 필요해 뷰에서 처리(onDeleteThread).
 */
export function CommentThreadCard({
  thread,
  currentUserId,
  active,
  onActivate,
  onDeleteThread,
}: {
  thread: ThreadItem;
  currentUserId: string;
  active: boolean;
  onActivate: () => void;
  onDeleteThread: (threadId: string) => void;
}) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();

  function submitReply() {
    const text = reply.trim();
    if (!text) return;
    startTransition(async () => {
      try {
        await addWikiCommentReply(thread.id, text);
        setReply("");
        router.refresh();
      } catch {
        toast.error("답글 저장에 실패했습니다");
      }
    });
  }

  function toggleResolved() {
    startTransition(async () => {
      try {
        await resolveWikiCommentThread(thread.id, !thread.resolved);
        router.refresh();
      } catch {
        toast.error("상태 변경에 실패했습니다");
      }
    });
  }

  function removeComment(commentId: string) {
    startTransition(async () => {
      try {
        await deleteWikiComment(commentId);
        router.refresh();
      } catch {
        toast.error("삭제에 실패했습니다");
      }
    });
  }

  return (
    <div
      id={`thread-card-${thread.id}`}
      onClick={onActivate}
      className={cn(
        "bg-card cursor-pointer rounded-lg border p-3 text-sm transition-shadow",
        active ? "ring-primary/40 ring-2" : "hover:border-foreground/20",
        thread.resolved && "opacity-70",
      )}
    >
      {/* 앵커 인용문 */}
      <div className="text-muted-foreground mb-2 border-l-2 border-amber-400 pl-2 text-xs italic">
        “{thread.quote}”
      </div>

      <div className="space-y-2.5">
        {thread.comments.map((c, i) => (
          <div key={c.id} className="group/comment">
            <div className="flex items-center gap-1.5">
              <UserBadge user={c.author} size="xs" />
              <span className="text-muted-foreground text-[11px]">
                {formatDistanceToNow(c.createdAt, {
                  addSuffix: true,
                  locale: ko,
                })}
              </span>
              {/* 첫 댓글이 아니고 본인 것이면 답글 삭제 허용 */}
              {i > 0 && c.authorId === currentUserId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeComment(c.id);
                  }}
                  disabled={pending}
                  className="text-muted-foreground hover:text-destructive ml-auto opacity-0 transition-opacity group-hover/comment:opacity-100"
                  aria-label="답글 삭제"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <p className="mt-0.5 pl-6 break-words whitespace-pre-wrap">
              {c.body}
            </p>
          </div>
        ))}
      </div>

      {/* 답글 입력 (해결된 스레드는 감춤) */}
      {!thread.resolved && (
        <div
          className="mt-2.5 flex items-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                submitReply();
              }
            }}
            rows={1}
            placeholder="답글…"
            className="border-input bg-background focus-visible:ring-ring/40 min-h-8 flex-1 resize-none rounded-md border px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:outline-none"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0"
            disabled={pending || !reply.trim()}
            onClick={submitReply}
            aria-label="답글 전송"
          >
            <CornerDownLeft className="size-4" />
          </Button>
        </div>
      )}

      {/* 액션 바 */}
      <div
        className="mt-2 flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={pending}
          onClick={toggleResolved}
        >
          {thread.resolved ? (
            <>
              <RotateCcw className="size-3.5" /> 재오픈
            </>
          ) : (
            <>
              <Check className="size-3.5" /> 해결
            </>
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
          disabled={pending}
          onClick={() => onDeleteThread(thread.id)}
        >
          <Trash2 className="size-3.5" /> 삭제
        </Button>
      </div>
    </div>
  );
}
