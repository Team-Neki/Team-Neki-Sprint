"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { wikiExtensions } from "@/components/wiki/extensions";
import {
  Bold,
  Italic,
  Strikethrough,
  Quote,
  Code,
  Table as TableIcon,
  Workflow,
  Baseline,
  Image as ImageIcon,
  Link as LinkIcon,
  Undo,
  Redo,
  RotateCcw,
  Plus,
  Trash2,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  appendColumnEnd,
  appendRowEnd,
  removeLastColumnIfEmpty,
  removeLastRowIfEmpty,
} from "@/components/wiki/table-edit";
import { TableContextMenu } from "@/components/wiki/table-context-menu";
import {
  updateWikiContent,
  saveWikiDraft,
  discardWikiDraft,
} from "@/server/actions/wiki";
import {
  UploadPlaceholder,
  addUploadPlaceholder,
  findUploadPlaceholder,
  removeUploadPlaceholder,
} from "@/components/wiki/upload-placeholder";

/** 이미지 파일을 업로드하고 서빙 URL 을 반환. 실패 시 토스트 + null(본문 이미지 첨부). */
async function uploadImage(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await fetch("/api/wiki/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      toast.error(err?.error ?? "이미지 업로드에 실패했습니다");
      return null;
    }
    const { url } = (await res.json()) as { url: string };
    return url;
  } catch {
    toast.error("이미지 업로드에 실패했습니다");
    return null;
  }
}

/** FileList 에서 이미지 파일만 추출. */
function imageFilesFrom(files: FileList | null | undefined): File[] {
  return Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
}

/** 클립보드 HTML 에 이미지 외 실질 텍스트 콘텐츠가 있는지. */
function htmlHasText(html: string): boolean {
  if (!html) return false;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").trim().length > 0;
}

/**
 * 이미지 파일들을 병렬 업로드하고, 성공분만 원래 순서대로 본문에 삽입.
 * dropPos 가 있으면 그 위치(드롭 좌표)에, 없으면 현재 커서에 삽입한다.
 *
 * 업로드 동안 사용자가 계속 타이핑/편집할 수 있으므로 완료 시점의 selection/
 * 좌표를 쓰면 원래 붙여넣기·드롭한 위치를 벗어난다. 호출 시점에 placeholder
 * 위젯을 먼저 넣고 ProseMirror mapping 으로 추적한 뒤(upload-placeholder.ts),
 * 완료 시 그 위치에 삽입한다. 업로드 중 사용자가 placeholder 자리를 지우면
 * 삽입도 취소한다(위젯이 사라지는 것이 보이므로 의도된 취소로 간주).
 */
async function uploadAndInsertImages(
  editor: Editor | null,
  files: File[],
  dropPos?: number,
) {
  if (!editor || editor.isDestroyed || files.length === 0) return;
  const id = {};
  if (dropPos == null) {
    // 붙여넣기·툴바 첨부: 기존 insertContent 동작과 같이 선택 영역을 대체한다.
    editor.chain().focus().deleteSelection().run();
  }
  addUploadPlaceholder(editor.view, id, dropPos ?? editor.state.selection.from);
  try {
    const urls = (await Promise.all(files.map((f) => uploadImage(f)))).filter(
      (u): u is string => u !== null,
    );
    if (editor.isDestroyed || urls.length === 0) return;
    const pos = findUploadPlaceholder(editor.state, id);
    if (pos == null) return;
    const nodes = urls.map((src) => ({ type: "image", attrs: { src } }));
    editor.chain().insertContentAt(pos, nodes).run();
  } finally {
    if (!editor.isDestroyed) removeUploadPlaceholder(editor.view, id);
  }
}

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
  /** 저장/취소로 편집을 마칠 때 호출(뷰 모드로 복귀). */
  onExit?: () => void;
  /** 저장 상태를 부모(헤더)로 올려 저장/취소 버튼·상태 텍스트를 헤더에 렌더. */
  onStateChange?: (state: WikiEditorState) => void;
};

export const WikiEditor = forwardRef<WikiEditorHandle, WikiEditorProps>(
  function WikiEditor(
    { pageId, initialTitle, initialContent, draft, onExit, onStateChange },
    ref,
  ) {
    const router = useRouter();
    const startedFromDraft = !!draft;
    const [title, setTitle] = useState(draft?.title ?? initialTitle);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [usingDraft, setUsingDraft] = useState(startedFromDraft);
    // state 는 리렌더 전 연속 호출(Cmd+S 키 반복 등)을 못 막는다 — ref 로 동기 가드.
    const savingRef = useRef(false);
    const dirtyRef = useRef(false);
    // 표 hover 열/행 추가 버튼(T17)의 좌표 기준 컨테이너.
    const editorAreaRef = useRef<HTMLDivElement>(null);
    // editorProps 핸들러(생성 시점 클로저)에서 editor 인스턴스에 접근하기 위한 ref.
    const editorRef = useRef<Editor | null>(null);

    const editor = useEditor({
      immediatelyRender: false,
      extensions: [
        ...wikiExtensions({ placeholder: "내용을 입력하세요…" }),
        // 이미지 업로드 중 삽입 위치를 표시·추적하는 위젯(편집 모드 전용 —
        // 데코레이션이라 스키마/저장 내용에는 영향 없음).
        UploadPlaceholder,
      ],
      content: draft?.content ?? initialContent,
      editorProps: {
        attributes: { class: "tiptap focus:outline-none" },
        // 이미지 붙여넣기. ProseMirror 기본 paste 보다 먼저 실행되는 handlePaste 로
        // 가로챈다 — DOM paste 리스너는 PM 기본 처리 이후에 실행돼 HTML+파일 혼합
        // 클립보드(브라우저 '이미지 복사' 등)에서 핫링크+업로드본이 이중 삽입된다.
        // 업로드 성공 URL 만 삽입(base64 금지).
        // - 이미지 파일만(스크린샷·Finder 파일 복사·'이미지 복사'): 업로드 후 삽입,
        //   여러 장이면 순서 유지. Finder 가 넣는 파일명 text/plain 은 무시.
        // - HTML 에 텍스트가 함께 있으면(웹페이지 선택 복사·엑셀 표 등): 기본
        //   붙여넣기로 텍스트를 보존하고, 파일로 중복 동봉된 이미지는 HTML 쪽이
        //   정본이므로 업로드하지 않는다.
        handlePaste: (_view, event) => {
          const files = imageFilesFrom(event.clipboardData?.files);
          if (files.length === 0) return false;
          const html = event.clipboardData?.getData("text/html") ?? "";
          if (htmlHasText(html)) return false;
          void uploadAndInsertImages(editorRef.current, files);
          return true;
        },
        // 이미지 파일 드롭 → 드롭 좌표에 순서대로 삽입. moved(에디터 내 노드 이동)는
        // 기본 처리에 맡긴다.
        handleDrop: (view, event, _slice, moved) => {
          if (moved) return false;
          const files = imageFilesFrom(event.dataTransfer?.files);
          if (files.length === 0) return false;
          const pos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          })?.pos;
          void uploadAndInsertImages(editorRef.current, files, pos);
          return true;
        },
      },
      onUpdate: () => markDirty(),
    });

    useEffect(() => {
      editorRef.current = editor;
    }, [editor]);

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
        await updateWikiContent(pageId, title, content);
        dirtyRef.current = false;
        setDirty(false);
        router.refresh();
        onExit?.();
      } catch {
        toast.error("저장에 실패했습니다");
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    }, [cloneContent, pageId, title, router, onExit]);

    // 취소: 임시저장본 폐기 + 편집 종료(마지막 커밋본으로 되돌아감).
    const cancel = useCallback(async () => {
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

    // 임시저장본 무시하고 원본으로 되돌리기.
    const revertToOriginal = useCallback(async () => {
      if (!editor) return;
      editor.commands.setContent(initialContent);
      setTitle(initialTitle);
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
        try {
          await saveWikiDraft(pageId, title, content);
          dirtyRef.current = false;
          setDirty(false);
          setUsingDraft(true);
        } catch {
          /* draft 저장 실패는 조용히 무시(다음 편집에서 재시도) */
        }
      }, 1200);
      return () => clearTimeout(timer);
    }, [dirty, title, pageId, cloneContent]);

    // Cmd/Ctrl+S, Cmd/Ctrl+Enter 로 저장(커밋).
    // 주의: 캡처 단계(3번째 인자 true)로 등록한다. 버블 단계로 두면 ProseMirror 가
    // 에디터 DOM 에서 먼저 Enter 를 처리해 줄바꿈을 삽입한 뒤 이 리스너가 실행돼,
    // preventDefault 를 해도 줄바꿈이 이미 들어간다. 캡처 단계에서 가로채
    // stopPropagation 으로 이벤트가 에디터까지 닿지 못하게 막아 줄바꿈 없이 저장만 한다.
    useEffect(() => {
      function onKey(e: KeyboardEvent) {
        const mod = e.metaKey || e.ctrlKey;
        if (!mod) return;
        const k = e.key.toLowerCase();
        if (k === "s" || k === "enter") {
          e.preventDefault();
          e.stopPropagation();
          commit();
        }
      }
      window.addEventListener("keydown", onKey, true);
      return () => window.removeEventListener("keydown", onKey, true);
    }, [commit]);

    // 디바운스 임시저장 반영 전 이탈 시 편집 유실 경고(draft 로 대부분 보호되지만 안전장치).
    useEffect(() => {
      function onBeforeUnload(e: BeforeUnloadEvent) {
        if (!dirtyRef.current) return;
        e.preventDefault();
        e.returnValue = "";
      }
      window.addEventListener("beforeunload", onBeforeUnload);
      return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);

    const status = saving
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
      onStateChange?.({ status, saving });
    }, [status, saving, onStateChange]);

    return (
      <div className="mx-auto max-w-3xl">
        {usingDraft && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
            <span>
              임시 저장본을 불러왔습니다. 계속 편집하거나 원본으로 되돌릴 수
              있어요.
            </span>
            <button
              type="button"
              onClick={revertToOriginal}
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
            placeholder="제목 없음"
            className="border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-3xl"
          />
        </div>

        {editor && <Toolbar editor={editor} />}

        <div ref={editorAreaRef} className="relative mt-4">
          <EditorContent editor={editor} />
          {editor && (
            <>
              {/* 텍스트 선택 시 뜨는 버블 툴바(굵게·기울임·취소선·인라인코드·링크·색상).
                  코드블록/빈 선택에선 숨김. */}
              <BubbleMenu
                editor={editor}
                shouldShow={({ editor: ed, state }) =>
                  !state.selection.empty &&
                  ed.isEditable &&
                  !ed.isActive("codeBlock")
                }
              >
                <BubbleToolbar editor={editor} />
              </BubbleMenu>
              <TableHoverControls
                editor={editor}
                containerRef={editorAreaRef}
              />
              <TableContextMenu editor={editor} containerRef={editorAreaRef} />
            </>
          )}
        </div>
      </div>
    );
  },
);

/**
 * 표 가장자리 hover 열/행 추가 버튼(T17). 커서가 표 안에 있을 때, 그 표의 DOM
 * 사각형을 추적해 우측(열 추가)·하단(행 추가) 스트립을 오버레이한다. 스트립에
 * hover 하면 + 버튼이 나타나고, 클릭 시 마지막 열/행 뒤에 추가·드래그로 여러 개
 * 추가/삭제(table-edit.ts). 표 내부 로직은 건드리지 않고 좌표만 읽어 겹쳐
 * 그리므로 리사이즈/편집 동작과 독립적이다. (공지 에디터도 재사용 — export)
 */
export function TableHoverControls({
  editor,
  containerRef,
}: {
  editor: Editor;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    function update() {
      const container = containerRef.current;
      if (!container || editor.isDestroyed) {
        setRect(null);
        return;
      }
      const { $from } = editor.state.selection;
      let tablePos = -1;
      for (let d = $from.depth; d > 0; d -= 1) {
        if ($from.node(d).type.name === "table") {
          tablePos = $from.before(d);
          break;
        }
      }
      if (tablePos < 0) {
        setRect(null);
        return;
      }
      const dom = editor.view.nodeDOM(tablePos) as HTMLElement | null;
      const tableEl = dom?.querySelector("table") ?? dom;
      if (!tableEl) {
        setRect(null);
        return;
      }
      const tr = tableEl.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      setRect({
        top: tr.top - cr.top,
        left: tr.left - cr.left,
        width: tr.width,
        height: tr.height,
      });
    }
    update();
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [editor, containerRef]);

  // 열/행 추가·삭제를 드래그로 여러 개. 오른쪽/아래로 끌면 STEP 픽셀마다 마지막에
  // 한 개씩 추가, 반대 방향으로 끌면 끝에서부터 한 개씩 삭제한다(빈 행/열까지만 —
  // 내용 있는 셀을 만나면 멈춘다. table-edit.ts). 드래그 없이 클릭하면 한 개만 추가.
  function resizeByDrag(
    e: React.PointerEvent,
    axis: "x" | "y",
    add: () => boolean,
    remove: () => boolean,
  ) {
    e.preventDefault();
    const start = axis === "x" ? e.clientX : e.clientY;
    const STEP = axis === "x" ? 48 : 32;
    let net = 0; // 이 드래그로 순증감한 개수(음수 = 삭제)
    let dragged = false;
    const onMove = (ev: PointerEvent) => {
      const pos = axis === "x" ? ev.clientX : ev.clientY;
      // trunc: 시작점 주변 미세 이동(±STEP 미만)으로 바로 삭제되지 않게.
      const target = Math.trunc((pos - start) / STEP);
      if (target !== 0) dragged = true;
      while (net < target) {
        if (!add()) break;
        net += 1;
      }
      while (net > target) {
        if (!remove()) break; // 내용 있는 행/열 → 더 줄이지 않음
        net -= 1;
      }
    };
    // pointercancel(터치 제스처·OS 개입)에도 전역 리스너를 정리한다 — 안 하면
    // 리스너가 남아 이후 포인터 이동이 표를 계속 변경한다.
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
    };
    const onUp = () => {
      if (!dragged && net === 0) add(); // 클릭 = 1개 추가
      cleanup();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cleanup);
  }

  // 추가는 커서 위치와 무관하게 항상 마지막 열/행 뒤에(T22).
  const addColumn = () => appendColumnEnd(editor);
  const addRow = () => appendRowEnd(editor);
  const shrinkColumn = () => removeLastColumnIfEmpty(editor);
  const shrinkRow = () => removeLastRowIfEmpty(editor);

  if (!rect) return null;
  return (
    <>
      {/* 우측: 열 추가(드래그로 여러 개) + 열 삭제 */}
      <div
        className="wiki-table-add wiki-table-add-col"
        style={{
          top: rect.top,
          left: rect.left + rect.width,
          height: rect.height,
          flexDirection: "column",
          gap: 4,
        }}
      >
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => resizeByDrag(e, "x", addColumn, shrinkColumn)}
          aria-label="열 추가 (드래그로 여러 개 추가/삭제)"
          title="열 추가 · 드래그로 여러 개 추가/삭제"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().deleteColumn().run()}
          aria-label="열 삭제"
          title="열 삭제"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {/* 하단: 행 추가(드래그로 여러 개) + 행 삭제 */}
      <div
        className="wiki-table-add wiki-table-add-row"
        style={{
          top: rect.top + rect.height,
          left: rect.left,
          width: rect.width,
          gap: 4,
        }}
      >
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => resizeByDrag(e, "y", addRow, shrinkRow)}
          aria-label="행 추가 (드래그로 여러 개 추가/삭제)"
          title="행 추가 · 드래그로 여러 개 추가/삭제"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().deleteRow().run()}
          aria-label="행 삭제"
          title="행 삭제"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </>
  );
}

/** 버블 툴바용 소형 버튼. onMouseDown preventDefault 로 클릭 시 에디터 선택이 풀리지 않게 한다. */
function BubbleBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn("size-7", active && "bg-accent text-accent-foreground")}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/**
 * 텍스트 선택 시 뜨는 버블 툴바. 상단 툴바로 이동하지 않고 그 자리에서 서식을 준다.
 * 링크/색상은 별도 Popover(포털) 대신 버블 내부 모드 전환으로 처리해, 인풋 포커스 이동에도
 * 선택/버블이 유지되게 한다(포털 오버레이는 선택 해제로 버블이 닫히는 문제가 있음).
 */
function BubbleToolbar({ editor }: { editor: Editor }) {
  const [mode, setMode] = useState<"menu" | "link" | "color">("menu");
  const [url, setUrl] = useState("");

  const shell =
    "bg-popover text-popover-foreground ring-foreground/10 flex items-center gap-0.5 rounded-lg p-1 shadow-md ring-1";

  function openLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    setUrl(prev ?? "");
    setMode("link");
  }

  function applyLink() {
    const href = url.trim();
    if (href === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setMode("menu");
  }

  if (mode === "link") {
    return (
      <div className={shell}>
        <BubbleBtn label="뒤로" onClick={() => setMode("menu")}>
          <ChevronLeft className="size-4" />
        </BubbleBtn>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
          className="flex items-center gap-1"
        >
          <Input
            autoFocus
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-7 w-52"
          />
          <Button type="submit" size="sm" className="h-7 shrink-0">
            {editor.isActive("link") ? "변경" : "추가"}
          </Button>
        </form>
      </div>
    );
  }

  if (mode === "color") {
    return (
      <div className={shell}>
        <BubbleBtn label="뒤로" onClick={() => setMode("menu")}>
          <ChevronLeft className="size-4" />
        </BubbleBtn>
        {TEXT_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={c.name}
            title={c.name}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().setColor(c.value).run();
              setMode("menu");
            }}
            className="border-border size-5 rounded-md border"
            style={{ background: c.value }}
          />
        ))}
        <BubbleBtn
          label="기본 색"
          onClick={() => {
            editor.chain().focus().unsetColor().run();
            setMode("menu");
          }}
        >
          <RotateCcw className="size-3.5" />
        </BubbleBtn>
      </div>
    );
  }

  return (
    <div className={shell}>
      <BubbleBtn
        label="굵게"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </BubbleBtn>
      <BubbleBtn
        label="기울임"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </BubbleBtn>
      <BubbleBtn
        label="취소선"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </BubbleBtn>
      <BubbleBtn
        label="인라인 코드"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="size-4" />
      </BubbleBtn>
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <BubbleBtn
        label="링크"
        active={editor.isActive("link")}
        onClick={openLink}
      >
        <LinkIcon className="size-4" />
      </BubbleBtn>
      <BubbleBtn label="글자 색" onClick={() => setMode("color")}>
        <Baseline className="size-4" />
      </BubbleBtn>
    </div>
  );
}

export function Toolbar({ editor }: { editor: Editor }) {
  // 제목(H1~3)·목록(글머리/번호/체크) 아이콘은 제거했다 — 제목은 '#'(개수만큼 h1~h6),
  // 목록은 '-'/'1.'/'[ ]' 또는 슬래시 커맨드(/)로 만든다. (공지 에디터도 재사용 — export)
  return (
    <TooltipProvider delay={150}>
      <div className="bg-background/80 sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-md border p-1 backdrop-blur">
        <Btn
          label="굵게"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </Btn>
        <Btn
          label="기울임"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </Btn>
        <Btn
          label="취소선"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="size-4" />
        </Btn>
        <ColorButton editor={editor} />
        <Sep />
        <Btn
          label="인용"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="size-4" />
        </Btn>
        <Btn
          label="코드 블록"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code className="size-4" />
        </Btn>
        <TableButton editor={editor} />
        <Btn
          label="다이어그램(mermaid)"
          onClick={() =>
            editor.chain().focus().insertContent({ type: "mermaidBlock" }).run()
          }
        >
          <Workflow className="size-4" />
        </Btn>
        <ImageButton editor={editor} />
        <LinkButton editor={editor} />
        <Sep />
        <Btn
          label="실행 취소"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo className="size-4" />
        </Btn>
        <Btn
          label="다시 실행"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo className="size-4" />
        </Btn>
      </div>
    </TooltipProvider>
  );
}

// 큐레이트 글자 색 팔레트. DESIGN 은 새 액센트 남용을 금하지만 본문 글자색은 사용자
// 콘텐츠(상태 태그 예외와 동일)라 제한된 팔레트로만 허용한다.
const TEXT_COLORS: { name: string; value: string }[] = [
  { name: "회색", value: "#6b7280" },
  { name: "빨강", value: "#e5484d" },
  { name: "주황", value: "#f76808" },
  { name: "노랑", value: "#d97706" },
  { name: "초록", value: "#30a46c" },
  { name: "파랑", value: "#0070f3" },
  { name: "보라", value: "#8e4ec6" },
  { name: "분홍", value: "#e93d82" },
];

/**
 * 팝오버 트리거 버튼에 빠른 Tooltip 을 입힌다(네이티브 title 지연 대신). Base UI 는 render
 * 합성을 지원하므로 Tooltip 트리거가 Popover 트리거를, 그게 다시 Button 을 감싸 한 <button>
 * 에 hover 툴팁 + click 팝오버가 모두 붙는다. 반드시 <Popover> 안에서 사용한다.
 */
function TooltipPopoverTrigger({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<PopoverTrigger render={children} />} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** 글자 색상 선택(Color 확장). 팔레트 스와치 클릭 → setColor, '기본 색' → unsetColor. */
function ColorButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const current = editor.getAttributes("textStyle").color as string | undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipPopoverTrigger label="글자 색">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="글자 색"
          className={cn(
            "size-8",
            current && "bg-accent text-accent-foreground",
          )}
        >
          <Baseline
            className="size-4"
            style={current ? { color: current } : undefined}
          />
        </Button>
      </TooltipPopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-4 gap-1">
          {TEXT_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={c.name}
              title={c.name}
              onClick={() => {
                editor.chain().focus().setColor(c.value).run();
                setOpen(false);
              }}
              className="border-border size-6 rounded-md border"
              style={{ background: c.value }}
            />
          ))}
        </div>
        <Separator className="my-2" />
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().unsetColor().run();
            setOpen(false);
          }}
          className="hover:bg-accent w-full rounded px-2 py-1 text-left text-sm"
        >
          기본 색
        </button>
      </PopoverContent>
    </Popover>
  );
}

/** 이미지 첨부 버튼: 파일 선택(여러 장 가능) → 업로드 → 순서대로 본문에 삽입.
 * 붙여넣기/드롭은 editorProps handlePaste/handleDrop 에서 처리. */
function ImageButton({ editor }: { editor: Editor }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = imageFilesFrom(e.target.files);
    e.target.value = ""; // 같은 파일 재선택 허용
    if (files.length === 0) return;
    setBusy(true);
    try {
      await uploadAndInsertImages(editor, files);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={onPick}
      />
      <Btn
        label="이미지 첨부"
        onClick={() => inputRef.current?.click()}
        active={busy}
      >
        <ImageIcon className="size-4" />
      </Btn>
    </>
  );
}

function TableMenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-accent w-full rounded px-2 py-1.5 text-left text-sm"
    >
      {children}
    </button>
  );
}

/** 표 삽입 전 크기를 hover 로 고르는 그리드 픽커(최대 8×8). 클릭 시 rows×cols 로 삽입. */
function TableSizePicker({
  onPick,
}: {
  onPick: (rows: number, cols: number) => void;
}) {
  const MAX = 8;
  const [hover, setHover] = useState({ rows: 0, cols: 0 });

  return (
    <div>
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${MAX}, 1fr)` }}
        onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
      >
        {Array.from({ length: MAX * MAX }).map((_, i) => {
          const r = Math.floor(i / MAX) + 1;
          const c = (i % MAX) + 1;
          const on = r <= hover.rows && c <= hover.cols;
          return (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover({ rows: r, cols: c })}
              onClick={() => onPick(r, c)}
              aria-label={`${r} × ${c} 표`}
              className={cn(
                "size-4 rounded-[2px] border",
                on ? "border-primary bg-primary/70" : "border-border bg-muted",
              )}
            />
          );
        })}
      </div>
      <p className="text-muted-foreground mt-1.5 text-center text-xs">
        {hover.rows > 0 ? `${hover.rows} × ${hover.cols}` : "표 크기 선택"}
      </p>
    </div>
  );
}

/** 표 삽입(크기 픽커) + (표 안일 때) 행·열 편집 메뉴. Base UI Popover. */
function TableButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const inTable = editor.isActive("table");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipPopoverTrigger label="표">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="표"
          className={cn(
            "size-8",
            inTable && "bg-accent text-accent-foreground",
          )}
        >
          <TableIcon className="size-4" />
        </Button>
      </TooltipPopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        {!inTable ? (
          <TableSizePicker
            onPick={(rows, cols) => {
              editor
                .chain()
                .focus()
                .insertTable({ rows, cols, withHeaderRow: true })
                .run();
              setOpen(false);
            }}
          />
        ) : (
          <div className="w-44">
            {/* 추가는 항상 마지막 행/열 뒤(T22). 커서 기준 삽입은 단축키
                (Ctrl+Option+방향키)와 우클릭 메뉴로 제공한다. */}
            <TableMenuItem onClick={() => appendRowEnd(editor)}>
              맨 아래 행 추가
            </TableMenuItem>
            <TableMenuItem onClick={() => appendColumnEnd(editor)}>
              맨 오른쪽 열 추가
            </TableMenuItem>
            <TableMenuItem
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              행 삭제
            </TableMenuItem>
            <TableMenuItem
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              열 삭제
            </TableMenuItem>
            <TableMenuItem
              onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            >
              헤더 행 토글
            </TableMenuItem>
            <Separator className="my-1" />
            <TableMenuItem
              onClick={() => {
                editor.chain().focus().deleteTable().run();
                setOpen(false);
              }}
            >
              표 삭제
            </TableMenuItem>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function LinkButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const isActive = editor.isActive("link");

  function handleOpenChange(next: boolean) {
    if (next) {
      const prev = editor.getAttributes("link").href as string | undefined;
      setUrl(prev ?? "");
    }
    setOpen(next);
  }

  function apply() {
    const href = url.trim();
    if (href === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <TooltipPopoverTrigger label="링크">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-8",
            isActive && "bg-accent text-accent-foreground",
          )}
          aria-label="링크"
        >
          <LinkIcon className="size-4" />
        </Button>
      </TooltipPopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          className="flex items-center gap-2"
        >
          <Input
            autoFocus
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-8"
          />
          <Button type="submit" size="sm" className="h-8 shrink-0">
            {isActive ? "변경" : "추가"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function Btn({
  label,
  active,
  onClick,
  children,
}: {
  // 아이콘 전용 툴바 버튼이라 스크린리더용 이름(aria-label) 필수. 네이티브 title(브라우저
  // 기본 지연 ~1.5s, 조절 불가) 대신 Base UI Tooltip 으로 감싸 빠르게(≈150ms) 띄운다.
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            aria-pressed={active}
            className={cn(
              "size-8",
              active && "bg-accent text-accent-foreground",
            )}
            onClick={onClick}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Sep() {
  return <Separator orientation="vertical" className="mx-0.5 h-5" />;
}
