"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { wikiExtensions } from "@/components/wiki/extensions";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Table as TableIcon,
  Workflow,
  Link as LinkIcon,
  Undo,
  Redo,
  RotateCcw,
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
import { cn } from "@/lib/utils";
import {
  updateWikiContent,
  saveWikiDraft,
  discardWikiDraft,
} from "@/server/actions/wiki";

export function WikiEditor({
  pageId,
  initialTitle,
  initialContent,
  draft,
  onExit,
}: {
  pageId: string;
  initialTitle: string;
  initialContent: JSONContent;
  /** 서버에서 불러온 임시저장본(있으면 이 내용으로 편집을 시작). */
  draft?: { title: string; content: JSONContent } | null;
  /** 저장/취소로 편집을 마칠 때 호출(뷰 모드로 복귀). */
  onExit?: () => void;
}) {
  const router = useRouter();
  const startedFromDraft = !!draft;
  const [title, setTitle] = useState(draft?.title ?? initialTitle);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [usingDraft, setUsingDraft] = useState(startedFromDraft);
  const dirtyRef = useRef(false);

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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "s" || k === "enter") {
        e.preventDefault();
        commit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  return (
    <div className="mx-auto max-w-3xl">
      {usingDraft && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          <span>임시 저장본을 불러왔습니다. 계속 편집하거나 원본으로 되돌릴 수 있어요.</span>
          <button
            type="button"
            onClick={revertToOriginal}
            className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-medium hover:bg-amber-100"
          >
            <RotateCcw className="size-3.5" /> 원본으로
          </button>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between gap-2">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markDirty();
          }}
          placeholder="제목 없음"
          className="border-none px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-3xl"
        />
        <div className="flex shrink-0 items-center gap-2">
          {status && (
            <span className="text-muted-foreground text-xs">{status}</span>
          )}
          <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>
            취소
          </Button>
          <Button size="sm" onClick={commit} disabled={saving}>
            저장
          </Button>
        </div>
      </div>

      {editor && <Toolbar editor={editor} />}

      <EditorContent editor={editor} className="mt-4" />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="bg-background/80 sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-md border p-1 backdrop-blur">
      <Btn label="굵게" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </Btn>
      <Btn label="기울임" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </Btn>
      <Btn label="취소선" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="size-4" />
      </Btn>
      <Sep />
      <Btn label="제목 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="size-4" />
      </Btn>
      <Btn label="제목 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="size-4" />
      </Btn>
      <Btn label="제목 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="size-4" />
      </Btn>
      <Sep />
      <Btn label="글머리 목록" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="size-4" />
      </Btn>
      <Btn label="번호 목록" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </Btn>
      <Btn label="체크리스트" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListChecks className="size-4" />
      </Btn>
      <Sep />
      <Btn label="인용" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="size-4" />
      </Btn>
      <Btn label="코드 블록" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code className="size-4" />
      </Btn>
      <TableButton editor={editor} />
      <Btn label="다이어그램(mermaid)" onClick={() => editor.chain().focus().insertContent({ type: "mermaidBlock" }).run()}>
        <Workflow className="size-4" />
      </Btn>
      <LinkButton editor={editor} />
      <Sep />
      <Btn label="실행 취소" onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="size-4" />
      </Btn>
      <Btn label="다시 실행" onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="size-4" />
      </Btn>
    </div>
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

/** 표 삽입 + (표 안일 때) 행·열 편집 메뉴. Base UI Popover 안 버튼 리스트. */
function TableButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const inTable = editor.isActive("table");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="표"
            title="표"
            className={cn(
              "size-8",
              inTable && "bg-accent text-accent-foreground",
            )}
          >
            <TableIcon className="size-4" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-44 p-1">
        <TableMenuItem
          onClick={() => {
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run();
            setOpen(false);
          }}
        >
          표 삽입 (3×3)
        </TableMenuItem>
        {inTable && (
          <>
            <Separator className="my-1" />
            <TableMenuItem
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              아래 행 추가
            </TableMenuItem>
            <TableMenuItem
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              오른쪽 열 추가
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
          </>
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
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href })
        .run();
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
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
        }
      />
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
  // 아이콘 전용 툴바 버튼이라 스크린리더용 이름(aria-label) 필수. title 로 툴팁도 겸함.
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
      className={cn("size-8", active && "bg-accent text-accent-foreground")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Sep() {
  return <Separator orientation="vertical" className="mx-0.5 h-5" />;
}
