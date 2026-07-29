"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CommentThreadCard,
  type ThreadItem,
} from "@/components/wiki/comment-thread-card";
import {
  createWikiCommentThread,
  deleteWikiCommentThread,
} from "@/server/actions/wiki-comments";

/**
 * 페이지 전체 댓글(본문 하단). 본문 특정 구간에 앵커된 인라인 댓글(우측 거터)과 달리
 * 문서 전체에 대한 의견을 남기는 자리 — task/epic/project/sprint 상세의 댓글 카드와
 * 같은 역할이다.
 *
 * 저장소는 인라인 댓글과 동일한 `WikiCommentThread` 를 쓰되 **`quote` 가 빈 스레드**를
 * 페이지 댓글로 취급한다(스키마 변경·마이그레이션 없음). 앵커 마크가 없으므로 본문
 * 저장(`saveWikiCommentAnchors`)의 영향을 받지 않고, 답글·해결·삭제는 인라인 댓글과
 * 완전히 동일한 서버 액션·카드 UI 를 재사용한다.
 */
export function WikiPageComments({
  pageId,
  threads,
  currentUserId,
}: {
  pageId: string;
  threads: ThreadItem[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      try {
        // quote="" → 페이지 전체 댓글(앵커 없음).
        await createWikiCommentThread(pageId, "", text);
        setBody("");
        router.refresh();
      } catch {
        toast.error("댓글 등록에 실패했습니다");
      }
    });
  }

  function remove(threadId: string) {
    startTransition(async () => {
      try {
        // 페이지 댓글은 본문 앵커 마크가 없어 스레드만 지우면 된다.
        await deleteWikiCommentThread(threadId);
        router.refresh();
      } catch {
        toast.error("삭제에 실패했습니다");
      }
    });
  }

  return (
    // 폭은 본문·헤더와 동일한 max-w-5xl(하단 섹션 공통 규약) — 지정하지 않으면
    // 전체 폭을 차지해 중앙정렬된 본문과 좌측이 어긋난다.
    <section className="mx-auto mt-10 max-w-5xl border-t pt-6">
      <h2 className="mb-3 text-sm font-medium">댓글 {threads.length}</h2>

      <div className="mb-4 flex flex-col gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="이 문서에 대한 의견을 남겨보세요"
          // ⌘/Ctrl+Enter 로 등록(에디터·인라인 댓글과 동일한 제스처).
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
            {pending ? "등록 중…" : "댓글 등록"}
          </Button>
        </div>
      </div>

      {threads.length === 0 ? (
        <p className="text-muted-foreground text-sm">아직 댓글이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {threads.map((t) => (
            <CommentThreadCard
              key={t.id}
              thread={t}
              currentUserId={currentUserId}
              // 하단 목록은 본문 하이라이트와 연동되지 않아 활성 상태 개념이 없다.
              active={false}
              onActivate={() => {}}
              onDeleteThread={remove}
            />
          ))}
        </div>
      )}
    </section>
  );
}
