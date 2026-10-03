"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import { Input } from "@/components/ui/input";
import { TableContextMenu } from "@/components/wiki/table-context-menu";
import {
  updateWikiContent,
  saveWikiDraft,
  discardWikiDraft,
} from "@/server/actions/wiki";
// 노션식 줄(블록) 핸들 — 선택/드래그 이동/블록 메뉴. 편집 모드 전용.
import { BlockHandle } from "@/components/wiki/block-handle";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  useSaveShortcuts,
  useWikiEditor,
} from "@/components/wiki/use-wiki-editor";
import { Toolbar } from "@/components/wiki/editor-toolbar";
import { BubbleToolbar, showBubble } from "@/components/wiki/bubble-toolbar";
import { TableHoverControls } from "@/components/wiki/table-hover-controls";

/** 저장/취소 버튼을 헤더(WikiDetail)에서 호출할 수 있도록 노출하는 핸들. */
export type WikiEditorHandle = {
  commit: () => void;
  cancel: () => void;
};

/** 편집 상태(헤더의 상태 텍스트·버튼 비활성에 사용). */
export type WikiEditorState = { status: string; saving: boolean };

type WikiEditorProps = {
  pageId: string;
  initialTitle: string;
  initialContent: JSONContent;
  /** 서버에서 불러온 임시저장본(있으면 이 내용으로 편집을 시작). */
  draft?: { title: string; content: JSONContent } | null;
  /** 편집 진입 시 관측한 페이지 updatedAt(ISO). 저장 시 낙관적 충돌 검사 기준. */
  updatedAt: string;
  /** 생성 직후 진입: 제목 인풋에 포커스(전체 선택), Enter 로 본문 이동. */
  autoFocusTitle?: boolean;
  /** 저장/취소로 편집을 마칠 때 호출(뷰 모드로 복귀). */
  onExit?: () => void;
  /** 저장 상태를 부모(헤더)로 올려 저장/취소 버튼·상태 텍스트를 헤더에 렌더. */
  onStateChange?: (state: WikiEditorState) => void;
};

export const WikiEditor = forwardRef<WikiEditorHandle, WikiEditorProps>(
  function WikiEditor(
    {
      pageId,
      initialTitle,
      initialContent,
      draft,
      updatedAt,
      autoFocusTitle,
      onExit,
      onStateChange,
    },
    ref,
  ) {
    const router = useRouter();
    const startedFromDraft = !!draft;
    const [title, setTitle] = useState(draft?.title ?? initialTitle);
    const [saving, setSaving] = useState(false);
    // 저장 후 새 본문이 서버에서 내려올 때까지 편집 모드를 유지하기 위한 transition.
    const [isRefreshing, startRefresh] = useTransition();
    const [dirty, setDirty] = useState(false);
    // 배너는 '진입 시 불러온' 임시저장본에만. 이번 세션의 자동 임시저장으로는 켜지 않는다.
    const [showDraftBanner, setShowDraftBanner] = useState(startedFromDraft);
    const [usingDraft, setUsingDraft] = useState(startedFromDraft);
    // 취소/원본으로 확인 다이얼로그(어느 쪽을 확인 중인지).
    const [confirm, setConfirm] = useState<null | "cancel" | "revert">(null);
    // state 는 리렌더 전 연속 호출(Cmd+S 키 반복 등)을 못 막는다 — ref 로 동기 가드.
    const savingRef = useRef(false);
    const dirtyRef = useRef(false);
    // 커밋 이후 도착한 임시저장 응답이 draft 를 되살리지 않도록, 커밋마다 세대를 올리고
    // 임시저장은 자기 세대가 현재와 같을 때만 성공으로 처리한다. 요청 자체는 취소할 수
    // 없으므로(서버 upsert 는 이미 실행) 커밋 직후 discardWikiDraft 로 한 번 더 지운다.
    const draftGenRef = useRef(0);
    // 표 hover 열/행 추가 버튼(T17)의 좌표 기준 컨테이너.
    const editorAreaRef = useRef<HTMLDivElement>(null);

    const editor = useWikiEditor({
      content: draft?.content ?? initialContent,
      placeholder: "내용을 입력하세요…",
      onUpdate: () => markDirty(),
    });

    const markDirty = useCallback(() => {
      dirtyRef.current = true;
      setDirty(true);
    }, []);

    // getJSON() 은 순수 JSON 으로 클론해 서버 액션에 넘긴다(RSC 직렬화, gotchas §7).
    const cloneContent = useCallback(() => {
      if (!editor) return null;
      return JSON.parse(JSON.stringify(editor.getJSON()));
    }, [editor]);

    // 명시적 저장(커밋): WikiPage 로 반영(리비전 생성) + 임시저장본 정리 → 뷰로 복귀.
    const commit = useCallback(async () => {
      if (savingRef.current) return;
      const content = cloneContent();
      if (!content) return;
      savingRef.current = true;
      setSaving(true);
      try {
        const result = await updateWikiContent(
          pageId,
          title,
          content,
          updatedAt,
        );
        if ("conflict" in result) {
          // 편집 모드·임시저장본 유지(dirtyRef 도 그대로) — 사용자가 새로고침 후 이어간다.
          toast.error(
            "다른 사용자가 먼저 저장했습니다. 페이지를 새로고침한 뒤 다시 편집해 주세요. 지금 편집 내용은 임시저장본에 남아 있습니다.",
          );
          return;
        }
        draftGenRef.current += 1;
        dirtyRef.current = false;
        setDirty(false);
        // 새 본문이 서버에서 내려올 때까지 편집 모드를 유지해 이전 본문이 잠깐 보이는 깜빡임을 막는다.
        startRefresh(() => {
          router.refresh();
          onExit?.();
        });
      } catch {
        toast.error("저장에 실패했습니다");
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    }, [cloneContent, pageId, title, updatedAt, router, onExit]);

    // 취소 실행: 임시저장본 폐기 + 편집 종료(마지막 커밋본으로 되돌아감).
    const doCancel = useCallback(async () => {
      // 진행 중인 자동 임시저장이 뒤늦게 draft 를 되살리지 않도록 세대를 올린다.
      draftGenRef.current += 1;
      try {
        await discardWikiDraft(pageId);
      } catch {
        /* 무시 — 어차피 편집 종료 */
      }
      dirtyRef.current = false;
      setDirty(false);
      router.refresh();
      onExit?.();
    }, [pageId, router, onExit]);

    // 헤더 '취소' 버튼: 버릴 변경(미저장 편집 또는 임시저장본)이 있을 때만 확인을 거친다.
    const cancel = useCallback(() => {
      if (dirtyRef.current || usingDraft) setConfirm("cancel");
      else void doCancel();
    }, [usingDraft, doCancel]);

    // 원본으로 되돌리기 실행: 임시저장본 무시하고 커밋본으로.
    const doRevert = useCallback(async () => {
      if (!editor) return;
      draftGenRef.current += 1;
      editor.commands.setContent(initialContent);
      setTitle(initialTitle);
      setShowDraftBanner(false);
      setUsingDraft(false);
      dirtyRef.current = false;
      setDirty(false);
      try {
        await discardWikiDraft(pageId);
      } catch {
        /* 무시 */
      }
    }, [editor, initialContent, initialTitle, pageId]);

    // 디바운스 임시저장(draft). 페이지 본문이 아니라 WikiDraft 로만 저장한다.
    useEffect(() => {
      if (!dirty) return;
      const timer = setTimeout(async () => {
        if (!dirtyRef.current) return;
        const content = cloneContent();
        if (!content) return;
        const gen = draftGenRef.current;
        try {
          await saveWikiDraft(pageId, title, content);
          if (gen !== draftGenRef.current) {
            // 커밋(또는 취소/되돌리기)이 먼저 끝났다 — 방금 만든 draft 는 유령. 정리.
            await discardWikiDraft(pageId).catch(() => {});
            return;
          }
          dirtyRef.current = false;
          setDirty(false);
          setUsingDraft(true);
        } catch {
          // id 고정으로 반복 실패 시 토스트 1개만 유지.
          toast.error(
            "임시저장에 실패했습니다. 저장 버튼으로 직접 저장해 주세요.",
            { id: "wiki-draft-fail" },
          );
        }
      }, 1200);
      return () => clearTimeout(timer);
    }, [dirty, title, pageId, cloneContent]);

    // Cmd/Ctrl+S·Cmd/Ctrl+Enter 저장 + 미저장 이탈 경고(draft 반영 전 안전장치).
    useSaveShortcuts(commit, dirtyRef);

    // 저장 후 새로고침 대기 중에도 '저장 중…' + 버튼 비활성 유지.
    const busy = saving || isRefreshing;
    const status = busy
      ? "저장 중…"
      : dirty
        ? "임시저장 대기"
        : usingDraft
          ? "임시저장됨"
          : "";

    // 저장/취소 커맨드를 헤더(WikiDetail)에서 호출할 수 있게 노출.
    useImperativeHandle(ref, () => ({ commit, cancel }), [commit, cancel]);

    // 저장 상태를 헤더로 전달 — 저장/취소 버튼과 상태 텍스트는 헤더에서 렌더한다.
    useEffect(() => {
      onStateChange?.({ status, saving: busy });
    }, [status, busy, onStateChange]);

    return (
      // 읽기 뷰·헤더·하단 댓글과 같은 폭(5xl). 편집 진입 시 본문 리플로우 방지.
      <div className="mx-auto max-w-5xl">
        <ConfirmDelete
          open={confirm !== null}
          onOpenChange={(o) => !o && setConfirm(null)}
          title={
            confirm === "cancel" ? "편집을 취소할까요?" : "원본으로 되돌릴까요?"
          }
          description="저장하지 않은 변경 내용과 임시저장본이 사라집니다."
          confirmLabel="버리기"
          successMessage={null}
          onConfirm={confirm === "cancel" ? doCancel : doRevert}
        />

        {showDraftBanner && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
            <span>
              임시 저장본을 불러왔습니다. 계속 편집하거나 원본으로 되돌릴 수
              있어요.
            </span>
            <button
              type="button"
              onClick={() => setConfirm("revert")}
              className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-medium hover:bg-amber-100"
            >
              <RotateCcw className="size-3.5" /> 원본으로
            </button>
          </div>
        )}

        {/* 저장/취소·상태 텍스트는 WikiDetail 의 sticky 헤더로 올렸다(긴 본문 스크롤 시에도
          고정). 여기선 제목 입력만 둔다. */}
        <div className="mb-2">
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            // 생성 직후(?edit=1): 제목부터 바로 입력하도록 포커스+전체 선택,
            // Enter/Tab(또는 ↓)으로 본문 첫 위치로 이동해 이어서 작성한다.
            autoFocus={autoFocusTitle}
            onFocus={(e) => {
              if (autoFocusTitle) e.currentTarget.select();
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter" || e.key === "ArrowDown") {
                e.preventDefault();
                editor?.chain().focus("start").run();
              }
            }}
            placeholder="제목 없음"
            className="border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-3xl"
          />
        </div>

        {editor && <Toolbar editor={editor} />}

        <div ref={editorAreaRef} className="tiptap-editor-area relative mt-4">
          <EditorContent editor={editor} />
          {editor && (
            <>
              {/* 텍스트 선택 시 뜨는 버블 툴바(굵게·기울임·취소선·인라인코드·링크·색상).
                  코드블록/빈 선택에선 숨김. */}
              <BubbleMenu editor={editor} shouldShow={showBubble}>
                <BubbleToolbar editor={editor} />
              </BubbleMenu>
              <TableHoverControls
                editor={editor}
                containerRef={editorAreaRef}
              />
              <TableContextMenu editor={editor} containerRef={editorAreaRef} />
              <BlockHandle editor={editor} />
            </>
          )}
        </div>
      </div>
    );
  },
);
