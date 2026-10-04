"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Quote,
  Code,
  Table as TableIcon,
  Workflow,
  Baseline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Paperclip,
  Link as LinkIcon,
  Undo,
  Redo,
} from "lucide-react";
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
  setHeaderRowBackground,
} from "@/components/wiki/table-edit";
import {
  pickFiles,
  uploadAndInsertAny,
  uploadAndInsertImages,
} from "@/components/wiki/upload";
import {
  TEXT_COLORS,
  BG_COLORS,
  CELL_COLORS,
  type PaletteColor,
} from "@/components/wiki/colors";
import { normalizeHref } from "@/components/wiki/link-href";

export function Toolbar({ editor }: { editor: Editor }) {
  // 제목(H1~3)·목록(글머리/번호/체크) 아이콘은 제거했다 — 제목은 '#'(개수만큼 h1~h6),
  // 목록은 '-'/'1.'/'[ ]' 또는 슬래시 커맨드(/)로 만든다. (공지 에디터도 재사용 — export)
  return (
    <TooltipProvider delay={150}>
      {/* sticky 오프셋은 WikiDetail 헤더가 게시하는 --wiki-header-h(실측 높이). 변수가 없는
          곳(공지 에디터)은 종전 값 3.5rem 으로 폴백. */}
      <div className="bg-background/80 sticky top-[var(--wiki-header-h,3.5rem)] z-10 flex flex-wrap items-center gap-0.5 rounded-md border p-1 backdrop-blur">
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
        <AlignButton editor={editor} />
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
        <FileAttachButton editor={editor} />
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

// 팔레트 정본은 colors.ts(TEXT_COLORS/BG_COLORS) — 툴바·버블·테이블이 공유한다.

// 텍스트 정렬(TextAlign, 블록 단위). 툴바 팝오버·버블 툴바가 공유한다.
export const TEXT_ALIGNS: {
  value: "left" | "center" | "right";
  label: string;
  Icon: typeof AlignLeft;
}[] = [
  { value: "left", label: "왼쪽 정렬", Icon: AlignLeft },
  { value: "center", label: "가운데 정렬", Icon: AlignCenter },
  { value: "right", label: "오른쪽 정렬", Icon: AlignRight },
];

/** 색상 스와치 버튼. onMouseDown preventDefault 로 에디터 선택 유지. */
export function Swatch({
  color,
  size = "size-6",
  onClick,
}: {
  color: PaletteColor;
  size?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={color.name}
      title={color.name}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("border-border shrink-0 rounded-md border", size)}
      style={{ background: color.value }}
    />
  );
}

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

/** 텍스트 정렬 팝오버(블록 단위). 현재 정렬 아이콘을 트리거에 표시한다. */
function AlignButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const current =
    TEXT_ALIGNS.find((a) => editor.isActive({ textAlign: a.value })) ??
    TEXT_ALIGNS[0];
  const CurrentIcon = current.Icon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipPopoverTrigger label="정렬">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="정렬"
          className={cn(
            "size-8",
            current.value !== "left" && "bg-accent text-accent-foreground",
          )}
        >
          <CurrentIcon className="size-4" />
        </Button>
      </TooltipPopoverTrigger>
      <PopoverContent align="start" className="flex w-auto gap-0.5 p-1">
        {TEXT_ALIGNS.map(({ value, label, Icon }) => (
          <Btn
            key={value}
            label={label}
            active={editor.isActive({ textAlign: value })}
            onClick={() => {
              editor.chain().focus().setTextAlign(value).run();
              setOpen(false);
            }}
          >
            <Icon className="size-4" />
          </Btn>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** 글자 색/배경색 선택(Color·BackgroundColor 확장). 스와치 → set, '기본/없음' → unset. */
function ColorButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const attrs = editor.getAttributes("textStyle");
  const current = attrs.color as string | undefined;
  const currentBg = attrs.backgroundColor as string | undefined;

  const resetBtn =
    "hover:bg-accent w-full rounded px-2 py-1 text-left text-sm";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipPopoverTrigger label="글자 색 · 배경색">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="글자 색 · 배경색"
          className={cn(
            "size-8",
            (current || currentBg) && "bg-accent text-accent-foreground",
          )}
        >
          <Baseline
            className="size-4"
            style={current ? { color: current } : undefined}
          />
        </Button>
      </TooltipPopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <p className="text-muted-foreground mb-1 text-xs">글자 색</p>
        <div className="grid grid-cols-5 gap-1">
          {TEXT_COLORS.map((c) => (
            <Swatch
              key={c.value}
              color={c}
              onClick={() => {
                editor.chain().focus().setColor(c.value).run();
                setOpen(false);
              }}
            />
          ))}
        </div>
        <button
          type="button"
          className={cn(resetBtn, "mt-1")}
          onClick={() => {
            editor.chain().focus().unsetColor().run();
            setOpen(false);
          }}
        >
          기본 색
        </button>
        <Separator className="my-2" />
        <p className="text-muted-foreground mb-1 text-xs">배경색</p>
        <div className="grid grid-cols-5 gap-1">
          {BG_COLORS.map((c) => (
            <Swatch
              key={c.value}
              color={c}
              onClick={() => {
                editor.chain().focus().setBackgroundColor(c.value).run();
                setOpen(false);
              }}
            />
          ))}
        </div>
        <button
          type="button"
          className={cn(resetBtn, "mt-1")}
          onClick={() => {
            editor.chain().focus().unsetBackgroundColor().run();
            setOpen(false);
          }}
        >
          배경 없음
        </button>
      </PopoverContent>
    </Popover>
  );
}

/** 이미지 첨부 버튼: 파일 선택(여러 장 가능, pickFiles) → 업로드 → 순서대로 본문에
 * 삽입. 붙여넣기/드롭은 editorProps handlePaste/handleDrop 에서 처리. */
function ImageButton({ editor }: { editor: Editor }) {
  const [busy, setBusy] = useState(false);

  async function onPick() {
    setBusy(true);
    try {
      const files = await pickFiles({
        accept: "image/png,image/jpeg,image/gif,image/webp",
        multiple: true,
      });
      await uploadAndInsertImages(editor, files);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Btn label="이미지 첨부" onClick={onPick} active={busy}>
      <ImageIcon className="size-4" />
    </Btn>
  );
}

/** 파일 첨부 버튼: 파일 선택(여러 개 가능) → 업로드 → 이미지는 image 노드, 그 외는
 * fileAttachment 노드(다운로드 칩)로 삽입(upload.ts uploadAndInsertAny). */
function FileAttachButton({ editor }: { editor: Editor }) {
  const [busy, setBusy] = useState(false);

  async function onPick() {
    setBusy(true);
    try {
      const files = await pickFiles({ multiple: true });
      await uploadAndInsertAny(editor, files);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Btn label="파일 첨부" onClick={onPick} active={busy}>
      <Paperclip className="size-4" />
    </Btn>
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
            {/* 헤더(첫 행) 배경색 일괄 적용. '기본'은 --muted 인셋으로 복원. */}
            <div className="px-2 py-1.5">
              <p className="text-muted-foreground mb-1 text-xs">헤더 배경색</p>
              <div className="flex flex-wrap gap-1">
                {CELL_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.name}
                    title={c.name}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setHeaderRowBackground(editor, c.value);
                      setOpen(false);
                    }}
                    className="border-border size-5 rounded border"
                    style={{ background: c.value }}
                  />
                ))}
                <button
                  type="button"
                  aria-label="기본 배경"
                  title="기본 배경"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setHeaderRowBackground(editor, null);
                    setOpen(false);
                  }}
                  className="border-border text-muted-foreground size-5 rounded border text-[10px] leading-none"
                >
                  ×
                </button>
              </div>
            </div>
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

/** 링크 적용(툴바·버블 공용). 입력을 정규화하고, 빈 값·위험 스킴(normalizeHref 가
 * null)이면 링크를 해제한다. 커서가 링크 안이면 그 링크 전체에 적용된다. */
export function applyLink(editor: Editor, url: string) {
  const href = normalizeHref(url);
  if (href === null) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
  } else {
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }
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
            applyLink(editor, url);
            setOpen(false);
          }}
          className="flex items-center gap-2"
        >
          <Input
            autoFocus
            type="text"
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
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
