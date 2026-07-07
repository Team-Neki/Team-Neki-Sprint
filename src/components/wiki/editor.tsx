"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
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
  Link as LinkIcon,
  Undo,
  Redo,
} from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { updateWikiContent } from "@/server/actions/wiki";

export function WikiEditor({
  pageId,
  initialTitle,
  initialContent,
}: {
  pageId: string;
  initialTitle: string;
  initialContent: JSONContent;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: "내용을 입력하세요…" }),
      Link.configure({ openOnClick: false, autolink: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: "tiptap focus:outline-none" },
    },
    onUpdate: () => markDirty(),
  });

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!editor) return;
    setSaving(true);
    try {
      await updateWikiContent(pageId, title, editor.getJSON());
      dirtyRef.current = false;
      setDirty(false);
      router.refresh();
    } catch {
      toast.error("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  }, [editor, pageId, title, router]);

  // Debounced autosave.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      if (dirtyRef.current) save();
    }, 1500);
    return () => clearTimeout(timer);
  }, [dirty, title, save]);

  // Save on Cmd/Ctrl+S.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  return (
    <div className="mx-auto max-w-3xl">
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
        <span className="text-muted-foreground shrink-0 text-xs">
          {saving ? "저장 중…" : dirty ? "저장 대기" : "저장됨"}
        </span>
      </div>

      {editor && <Toolbar editor={editor} />}

      <EditorContent editor={editor} className="mt-4" />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="bg-background/80 sticky top-14 z-10 flex flex-wrap items-center gap-0.5 rounded-md border p-1 backdrop-blur">
      <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-4" />
      </Btn>
      <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-4" />
      </Btn>
      <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="size-4" />
      </Btn>
      <Sep />
      <Btn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="size-4" />
      </Btn>
      <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="size-4" />
      </Btn>
      <Btn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="size-4" />
      </Btn>
      <Sep />
      <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="size-4" />
      </Btn>
      <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-4" />
      </Btn>
      <Btn active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListChecks className="size-4" />
      </Btn>
      <Sep />
      <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="size-4" />
      </Btn>
      <Btn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code className="size-4" />
      </Btn>
      <Btn active={editor.isActive("link")} onClick={setLink}>
        <LinkIcon className="size-4" />
      </Btn>
      <Sep />
      <Btn onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="size-4" />
      </Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="size-4" />
      </Btn>
    </div>
  );
}

function Btn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
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
