"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import { MessageSquarePlus, MessageSquare } from "lucide-react";
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

/**
 * B10 위키 읽기 뷰 + 구글독스식 인라인 댓글. 본문을 읽기전용 Tiptap 으로 렌더하되,
 * 텍스트를 선택하면 플로팅 '댓글' 버튼이 뜨고, 달면 선택 범위에 commentMark(앵커)를
 * 씌운 뒤 우측 패널에 스레드가 나타난다. 앵커 클릭 ↔ 패널 스레드가 서로 하이라이트/스크롤.
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
}: {
  pageId: string;
  title: string;
  content: JSONContent;
  threads: ThreadItem[];
  currentUserId: string;
}) {
  const router = useRouter();
  const leftRef = useRef<HTMLDivElement>(null);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: wikiExtensions(),
    content,
    editorProps: { attributes: { class: "tiptap focus:outline-none" } },
  });

  const open = threads.filter((t) => !t.resolved);
  const resolved = threads.filter((t) => t.resolved);

  // 선택 → 플로팅 버튼 위치 계산. 선택이 에디터 본문 안에 완전히 있을 때만.
  const onMouseUp = useCallback(() => {
    if (!editor || composing) return;
    const sel = window.getSelection();
    const dom = editor.view.dom as HTMLElement;
    const left = leftRef.current;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !left) {
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
    const base = left.getBoundingClientRect();
    setComposer({
      from,
      to,
      quote: quote.slice(0, 300),
      top: rect.top - base.top,
      left: Math.min(rect.left - base.left, base.width - 40),
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
      // 읽기전용 상태에서 트랜잭션을 확실히 반영하기 위해 잠깐 editable 을 켠다.
      editor.setEditable(true);
      editor
        .chain()
        .setTextSelection({ from: composer.from, to: composer.to })
        .setCommentThread(threadId)
        .run();
      const json = JSON.parse(JSON.stringify(editor.getJSON()));
      editor.setEditable(false);
      await saveWikiCommentAnchors(pageId, json);
      closeComposer();
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
        await saveWikiCommentAnchors(pageId, json);
        await deleteWikiCommentThread(threadId);
        if (activeId === threadId) setActiveId(null);
        router.refresh();
      } catch {
        toast.error("삭제에 실패했습니다");
      }
    },
    [editor, pageId, activeId, router],
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

  // 마크 span 에 is-active/is-resolved 클래스 동기화 + 활성 앵커↔카드 스크롤.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const resolvedIds = new Set(
      threads.filter((t) => t.resolved).map((t) => t.id),
    );
    const marks = dom.querySelectorAll<HTMLElement>(".wiki-comment-mark");
    marks.forEach((m) => {
      const id = m.getAttribute("data-comment-thread");
      m.classList.toggle("is-resolved", !!id && resolvedIds.has(id));
      m.classList.toggle("is-active", !!id && id === activeId);
    });
    if (activeId) {
      dom
        .querySelector(`.wiki-comment-mark[data-comment-thread="${activeId}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
      document
        .getElementById(`thread-card-${activeId}`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [editor, threads, activeId]);

  return (
    <div className="mx-auto flex max-w-5xl gap-6">
      <div ref={leftRef} className="relative min-w-0 flex-1">
        <h1 className="mb-4 text-2xl font-semibold break-words md:text-3xl">
          {title.trim() || "제목 없음"}
        </h1>
        <div onClick={onDocClick}>
          <EditorContent editor={editor} />
        </div>

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

      {/* 우측 코멘트 패널 */}
      <aside className="w-72 shrink-0">
        <div className="sticky top-20 space-y-2">
          <div className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs font-medium">
            <MessageSquare className="size-3.5" />
            댓글 {open.length > 0 && <span>({open.length})</span>}
          </div>

          {open.length === 0 && resolved.length === 0 ? (
            <p className="text-muted-foreground px-1 text-xs leading-relaxed">
              본문에서 텍스트를 선택해 댓글을 남겨보세요.
            </p>
          ) : (
            <div className="space-y-2">
              {open.map((t) => (
                <CommentThreadCard
                  key={t.id}
                  thread={t}
                  currentUserId={currentUserId}
                  active={activeId === t.id}
                  onActivate={() => setActiveId(t.id)}
                  onDeleteThread={deleteThread}
                />
              ))}

              {resolved.length > 0 && (
                <details className="group">
                  <summary className="text-muted-foreground cursor-pointer px-1 py-1 text-xs select-none">
                    해결됨 {resolved.length}
                  </summary>
                  <div className="mt-1 space-y-2">
                    {resolved.map((t) => (
                      <CommentThreadCard
                        key={t.id}
                        thread={t}
                        currentUserId={currentUserId}
                        active={activeId === t.id}
                        onActivate={() => setActiveId(t.id)}
                        onDeleteThread={deleteThread}
                      />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
