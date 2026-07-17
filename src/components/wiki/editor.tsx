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
    const dirtyRef = useRef(false);
    // 표 hover 열/행 추가 버튼(T17)의 좌표 기준 컨테이너.
    const editorAreaRef = useRef<HTMLDivElement>(null);

    const editor = useEditor({
      immediatelyRender: false,
      extensions: wikiExtensions({ placeholder: "내용을 입력하세요…" }),
      content: draft?.content ?? initialContent,
      editorProps: {
        attributes: { class: "tiptap focus:outline-none" },
      },
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
      const content = cloneContent();
      if (!content) return;
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

    // 이미지 붙여넣기/드롭 → 업로드 후 본문에 삽입. editorProps 대신 DOM 리스너로
    // 처리(editor 생성 이후 attach). 업로드 성공 URL 만 삽입(base64 금지).
    useEffect(() => {
      if (!editor) return;
      const dom = editor.view.dom;
      async function insertImageFiles(files: FileList, dropPos?: number) {
        const images = Array.from(files).filter((f) =>
          f.type.startsWith("image/"),
        );
        for (const file of images) {
          const url = await uploadImage(file);
          if (!url || !editor) continue;
          if (dropPos != null) {
            editor
              .chain()
              .insertContentAt(dropPos, { type: "image", attrs: { src: url } })
              .run();
          } else {
            editor.chain().focus().setImage({ src: url }).run();
          }
        }
      }
      function hasImage(files: FileList | undefined) {
        return (
          !!files &&
          files.length > 0 &&
          Array.from(files).some((f) => f.type.startsWith("image/"))
        );
      }
      function onPaste(e: ClipboardEvent) {
        const files = e.clipboardData?.files;
        if (hasImage(files)) {
          e.preventDefault();
          void insertImageFiles(files as FileList);
        }
      }
      function onDrop(e: DragEvent) {
        const files = e.dataTransfer?.files;
        if (hasImage(files)) {
          e.preventDefault();
          const pos = editor?.view.posAtCoords({
            left: e.clientX,
            top: e.clientY,
          })?.pos;
          void insertImageFiles(files as FileList, pos);
        }
      }
      dom.addEventListener("paste", onPaste);
      dom.addEventListener("drop", onDrop);
      return () => {
        dom.removeEventListener("paste", onPaste);
        dom.removeEventListener("drop", onDrop);
      };
    }, [editor]);

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
              <TableHoverControls editor={editor} containerRef={editorAreaRef} />
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
    const onUp = () => {
      if (!dragged && net === 0) add(); // 클릭 = 1개 추가
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
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

/** 이미지 첨부 버튼: 파일 선택 → 업로드 → 본문에 삽입. 붙여넣기/드롭도 지원(useEffect). */
function ImageButton({ editor }: { editor: Editor }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file);
      if (url) editor.chain().focus().setImage({ src: url }).run();
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
