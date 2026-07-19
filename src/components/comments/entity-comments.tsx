import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { RichContent } from "@/components/rich-text/rich-editor";
import { EntityCommentForm } from "@/components/comments/entity-comment-form";
import type { CommentEntityType } from "@/server/actions/comments";

// 댓글 목록 + 입력(task/epic/project/sprint 공용). 태스크 상세의 인라인 렌더를 일반화한 것.
// comments 는 이미 최신순(desc)으로 넘어온다(getEntityComments / getTask). 대댓글 없음.
export type EntityCommentItem = {
  id: string;
  body: string;
  createdAt: Date;
  author: MiniUser;
};

export function EntityComments({
  entityType,
  entityId,
  comments,
}: {
  entityType: CommentEntityType;
  entityId: string;
  comments: EntityCommentItem[];
}) {
  return (
    <div>
      {/* 입력은 상단 — 등록하면 최신 댓글이 바로 아래(목록 최상단)에 나타난다. */}
      <EntityCommentForm entityType={entityType} entityId={entityId} />
      <div className="mt-4 flex flex-col gap-4">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <UserBadge user={c.author} hideName />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {c.author.name ?? c.author.email}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDistanceToNow(c.createdAt, {
                    addSuffix: true,
                    locale: ko,
                  })}
                </span>
              </div>
              <RichContent value={c.body} className="mt-0.5" />
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-muted-foreground text-sm">아직 댓글이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
