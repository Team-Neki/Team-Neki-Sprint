"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { wikiExtensions } from "@/components/wiki/extensions";
import {
  CommentThreadCard,
  type ThreadItem,
} from "@/components/wiki/comment-thread-card";
import { Button } from "@/components/ui/button";
import {
  createWikiCommentThread,
  deleteWikiCommentThread,
  saveWikiCommentAnchors,
} from "@/server/actions/wiki-comments";

type Composer = {
  from: number;
  to: number;
  quote: string;
  top: number;
  left: number;
};

// 우측 댓글 거터 폭(px). 본문은 이만큼 padding-right 로 비워 카드와 겹치지 않게 한다.
const GUTTER = 296; // w-72(288) 카드 + 여유
const CARD_GAP = 8; // 세로로 겹칠 때 카드 간 최소 간격

// 우측 마진노트(거터) 레이아웃은 md 이상에서만. 모바일은 거터 폭이 안 나와 본문이
// 뭉개지므로, 댓글을 본문 아래 일반 흐름으로 스택한다. useSyncExternalStore 로
// 하이드레이션 안전하게 뷰포트를 읽는다(SSR/초기엔 데스크톱 가정 → 마운트 후 보정).
const WIDE_QUERY = "(min-width: 768px)";
function subscribeWide(cb: () => void) {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useIsWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
}

/**
 * B10 위키 읽기 뷰 + 구글독스식 인라인 댓글. 본문을 읽기전용 Tiptap 으로 렌더하되,
 * 텍스트를 선택하면 플로팅 '댓글' 버튼이 뜨고, 달면 선택 범위에 commentMark(앵커)를
 * 씌운 뒤 우측 거터에 그 앵커 세로위치에 맞춰 스레드 카드가 나타난다(sticky 아님 —
 * 본문과 함께 스크롤하며 댓글이 달린 위치 우측에 고정). 앵커 클릭 ↔ 카드 상호 하이라이트.
 *
 * 편집은 상위 WikiDetail 의 '편집' 버튼(WikiEditor)에서 하며, 여기선 하지 않는다.
 * 마크 적용 시에만 잠깐 editable 을 켰다 끈다(읽기전용에서 트랜잭션 디스패치 보장).
 */
export function WikiCommentsView({
  pageId,
  title,
  content,
  threads,
  currentUserId,
  updatedAt,
}: {
  pageId: string;
  title: string;
  content: JSONContent;
  threads: ThreadItem[];
  currentUserId: string;
  updatedAt: string;
}) {
  const router = useRouter();
  const isWide = useIsWide();
  const rootRef = useRef<HTMLDivElement>(null);
  // 낙관적 동시성 기준선(A3): 클라이언트가 마지막으로 관측한 페이지 updatedAt(ISO).
  const baselineRef = useRef(updatedAt);
  useEffect(() => {
    baselineRef.current = updatedAt;
  }, [updatedAt]);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 스레드별 카드 세로 위치(컨테이너 내부 px). 앵커 위치 + 겹침 회피 결과.
  const [cardTops, setCardTops] = useState<Record<string, number>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: wikiExtensions(),
    content,
    editorProps: { attributes: { class: "tiptap focus:outline-none" } },
  });

  // Tiptap useEditor 는 최초 content 만 반영하고 이후 content prop 변경엔 반응하지 않는다.
  // 편집 저장(commit) 후 router.refresh() 로 새 본문이 내려와도, 뷰 셸이 이미 마운트돼 있어
  // 에디터가 옛 본문을 그대로 붙들고 있었다(→ 수동 새로고침해야 반영되던 버그). content 가
  // 실제로 바뀌면 에디터에 직접 반영해 즉시 갱신되게 한다. deps 가 content 참조 변경일 때만
  // 도므로, 댓글 마크 편집 같은 로컬 편집 중에는 실행되지 않는다.
  useEffect(() => {
    if (!editor) return;
    if (JSON.stringify(content) === JSON.stringify(editor.getJSON())) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  // 선택 → 플로팅 버튼 위치 계산. 선택이 에디터 본문 안에 완전히 있을 때만.
  const onMouseUp = useCallback(() => {
    if (!editor || composing) return;
    const sel = window.getSelection();
    const dom = editor.view.dom as HTMLElement;
    const root = rootRef.current;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !root) {
      setComposer(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!dom.contains(range.commonAncestorContainer)) {
      setComposer(null);
      return;
    }
    const quote = sel.toString().trim();
    if (!quote) {
      setComposer(null);
      return;
    }
    let from: number, to: number;
    try {
      const a = editor.view.posAtDOM(range.startContainer, range.startOffset);
      const b = editor.view.posAtDOM(range.endContainer, range.endOffset);
      from = Math.min(a, b);
      to = Math.max(a, b);
    } catch {
      setComposer(null);
      return;
    }
    if (from >= to) {
      setComposer(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    const base = root.getBoundingClientRect();
    setComposer({
      from,
      to,
      quote: quote.slice(0, 300),
      top: rect.top - base.top,
      left: Math.min(rect.left - base.left, base.width - GUTTER - 40),
    });
  }, [editor, composing]);

  useEffect(() => {
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [onMouseUp]);

  function closeComposer() {
    setComposer(null);
    setComposing(false);
    setDraft("");
  }

  // 앵커 content 저장 + 낙관적 동시성 충돌 처리(A3). 저장 성공 시 기준선 갱신하고 true,
  // 충돌(중간에 다른 사용자가 본문 저장)이면 알리고 새로고침 후 false.
  const persistAnchors = useCallback(
    async (json: unknown) => {
      const res = await saveWikiCommentAnchors(pageId, json, baselineRef.current);
      if (!res.ok) {
        toast.error(
          "다른 사용자가 페이지를 수정했습니다. 새로고침 후 다시 시도해주세요.",
        );
        router.refresh();
        return false;
      }
      baselineRef.current = res.updatedAt;
      return true;
    },
    [pageId, router],
  );

  // 댓글 생성: 스레드 생성 → 그 threadId 로 선택 범위에 마크 → content 저장.
  async function createThread() {
    if (!editor || !composer) return;
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      const { threadId } = await createWikiCommentThread(
        pageId,
        composer.quote,
        text,
      );
      editor.setEditable(true);
      editor
        .chain()
        .setTextSelection({ from: composer.from, to: composer.to })
        .setCommentThread(threadId)
        .run();
      const json = JSON.parse(JSON.stringify(editor.getJSON()));
      editor.setEditable(false);
      const ok = await persistAnchors(json);
      closeComposer();
      if (!ok) return;
      setActiveId(threadId);
      router.refresh();
    } catch {
      toast.error("댓글 저장에 실패했습니다");
    } finally {
      setBusy(false);
    }
  }

  // 스레드 삭제: 앵커 마크 제거 → content 저장 → 스레드 삭제.
  const deleteThread = useCallback(
    async (threadId: string) => {
      if (!editor) return;
      try {
        editor.setEditable(true);
        editor.chain().unsetCommentThread(threadId).run();
        const json = JSON.parse(JSON.stringify(editor.getJSON()));
        editor.setEditable(false);
        const ok = await persistAnchors(json);
        if (!ok) return;
        await deleteWikiCommentThread(threadId);
        if (activeId === threadId) setActiveId(null);
        router.refresh();
      } catch {
        toast.error("삭제에 실패했습니다");
      }
    },
    [editor, activeId, router, persistAnchors],
  );

  // 앵커 마크 클릭 → 스레드 활성화(이벤트 위임).
  function onDocClick(e: React.MouseEvent) {
    const el = (e.target as HTMLElement).closest?.(
      ".wiki-comment-mark",
    ) as HTMLElement | null;
    if (el) {
      const id = el.getAttribute("data-comment-thread");
      if (id) setActiveId(id);
    }
  }

  // 마크 span 에 is-active/is-resolved 클래스 동기화 + 각 스레드 카드를 앵커(첫 마크)
  // 세로위치에 맞춰 배치(겹치면 아래로 밀어 스택). 카드 높이는 렌더된 ref 로 측정하므로
  // 레이아웃 이후(effect)에 계산한다.
  const layout = useCallback(() => {
    if (!editor || !rootRef.current) return;
    const dom = editor.view.dom as HTMLElement;
    const base = rootRef.current.getBoundingClientRect();
    const valid = new Set(threads.map((t) => t.id));
    const resolvedIds = new Set(
      threads.filter((t) => t.resolved).map((t) => t.id),
    );

    // 스레드별 첫 앵커의 컨테이너 내부 top + 마크 클래스 동기화.
    const anchors: { id: string; top: number }[] = [];
    const seen = new Set<string>();
    dom.querySelectorAll<HTMLElement>(".wiki-comment-mark").forEach((m) => {
      const id = m.getAttribute("data-comment-thread");
      m.classList.toggle("is-resolved", !!id && resolvedIds.has(id));
      m.classList.toggle("is-active", !!id && id === activeId);
      if (!id || !valid.has(id) || seen.has(id)) return;
      seen.add(id);
      anchors.push({ id, top: m.getBoundingClientRect().top - base.top });
    });

    // 겹침 회피: 앵커 순서대로 이전 카드 bottom + gap 이하로는 안 내려가게.
    anchors.sort((a, b) => a.top - b.top);
    let prevBottom = -Infinity;
    const tops: Record<string, number> = {};
    for (const a of anchors) {
      const h = cardRefs.current[a.id]?.offsetHeight ?? 0;
      const top = Math.max(a.top, prevBottom + CARD_GAP);
      tops[a.id] = top;
      prevBottom = top + h;
    }
    setCardTops(tops);
  }, [editor, threads, activeId]);

  useEffect(() => {
    layout();
    if (activeId) {
      const dom = editor?.view.dom as HTMLElement | undefined;
      dom
        ?.querySelector(`.wiki-comment-mark[data-comment-thread="${activeId}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    // isWide 가 바뀌면(브레이크포인트 교차) 거터/카드 배치가 달라지므로 재계산.
  }, [layout, activeId, editor, isWide]);

  // 창 크기 변경 시 위치 재계산.
  useEffect(() => {
    window.addEventListener("resize", layout);
    return () => window.removeEventListener("resize", layout);
  }, [layout]);

  const hasComments = threads.length > 0;

  return (
    <div ref={rootRef} className="relative mx-auto max-w-5xl">
      {/* 본문: 데스크톱은 우측 댓글 거터만큼 비워 카드와 겹치지 않게. 모바일은 거터 폭이
          안 나오므로 전체폭 사용(댓글은 본문 아래로 스택). */}
      <div style={{ paddingRight: hasComments && isWide ? GUTTER : undefined }}>
        <h1 className="mb-4 text-2xl font-semibold break-words md:text-3xl">
          {title.trim() || "제목 없음"}
        </h1>
        <div onClick={onDocClick}>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* 데스크톱(md+): 각 스레드 카드를 앵커 세로위치에 우측 거터로 절대배치(sticky 아님). */}
      {isWide &&
        threads.map((t) => {
          const top = cardTops[t.id];
          return (
            <div
              key={t.id}
              id={`thread-card-${t.id}`}
              ref={(el) => {
                cardRefs.current[t.id] = el;
              }}
              style={{
                top: top ?? 0,
                visibility: top == null ? "hidden" : "visible",
              }}
              className="absolute right-0 w-72"
            >
              <CommentThreadCard
                thread={t}
                currentUserId={currentUserId}
                active={activeId === t.id}
                onActivate={() => setActiveId(t.id)}
                onDeleteThread={deleteThread}
              />
            </div>
          );
        })}

      {/* 모바일(<md): 마진노트 대신 본문 아래 일반 흐름으로 댓글 스택. 앵커 클릭 시
          해당 카드로 스크롤(id 유지). */}
      {!isWide && hasComments && (
        <div className="mt-8 space-y-3 border-t pt-6">
          <h2 className="text-muted-foreground text-sm font-medium">
            댓글 {threads.length}
          </h2>
          {threads.map((t) => (
            <div key={t.id} id={`thread-card-${t.id}`}>
              <CommentThreadCard
                thread={t}
                currentUserId={currentUserId}
                active={activeId === t.id}
                onActivate={() => setActiveId(t.id)}
                onDeleteThread={deleteThread}
              />
            </div>
          ))}
        </div>
      )}

      {/* 선택 시 플로팅 버튼/컴포저 */}
      {composer && (
        <div
          className="absolute z-30"
          style={{ top: composer.top, left: composer.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {composing ? (
            <div className="bg-popover w-64 -translate-y-full rounded-lg border p-2 shadow-md">
              <div className="text-muted-foreground mb-1.5 line-clamp-2 border-l-2 border-amber-400 pl-2 text-xs italic">
                “{composer.quote}”
              </div>
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeComposer();
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                    createThread();
                }}
                rows={3}
                placeholder="댓글을 입력하세요…"
                className="border-input bg-background focus-visible:ring-ring/40 w-full resize-none rounded-md border px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
              />
              <div className="mt-1.5 flex justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={closeComposer}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={busy || !draft.trim()}
                  onClick={createThread}
                >
                  댓글
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 -translate-y-full gap-1 px-2 text-xs shadow-md"
              onClick={() => setComposing(true)}
            >
              <MessageSquarePlus className="size-3.5" /> 댓글
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
