"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Baseline,
  Link as LinkIcon,
  RotateCcw,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { TEXT_COLORS, BG_COLORS } from "@/components/wiki/colors";
import {
  applyLink,
  Swatch,
  TEXT_ALIGNS,
} from "@/components/wiki/editor-toolbar";

/**
 * 버블 툴바 표시 조건. 반드시 모듈 스코프(참조 고정)로 둔다 — BubbleMenu 는 shouldShow
 * 참조가 바뀔 때마다 updateOptions 트랜잭션을 dispatch 하는데, 에디터가
 * shouldRerenderOnTransaction 이라 인라인 함수면 트랜잭션→리렌더→새 함수→dispatch 가
 * 무한 반복된다(본문 클릭 시 React #185, BACKEND-159).
 */
export function showBubble({ editor, state }: { editor: Editor; state: Editor["state"] }) {
  return !state.selection.empty && editor.isEditable && !editor.isActive("codeBlock");
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
export function BubbleToolbar({ editor }: { editor: Editor }) {
  const [mode, setMode] = useState<"menu" | "link" | "color">("menu");
  const [url, setUrl] = useState("");

  const shell =
    "bg-popover text-popover-foreground ring-foreground/10 flex items-center gap-0.5 rounded-lg p-1 shadow-md ring-1";

  function openLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    setUrl(prev ?? "");
    setMode("link");
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
            applyLink(editor, url);
            setMode("menu");
          }}
          className="flex items-center gap-1"
        >
          <Input
            autoFocus
            type="text"
            inputMode="url"
            autoCapitalize="off"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setMode("menu");
              }
            }}
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
    // 글자 색/배경색 2단. 스와치는 정본(colors.ts) 공유, 각 단 끝에 리셋 버튼.
    return (
      <div className={cn(shell, "items-start")}>
        <BubbleBtn label="뒤로" onClick={() => setMode("menu")}>
          <ChevronLeft className="size-4" />
        </BubbleBtn>
        <div className="flex flex-col gap-1 py-0.5">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground w-7 shrink-0 text-[10px]">
              글자
            </span>
            {TEXT_COLORS.map((c) => (
              <Swatch
                key={c.value}
                color={c}
                size="size-5"
                onClick={() => {
                  editor.chain().focus().setColor(c.value).run();
                  setMode("menu");
                }}
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
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground w-7 shrink-0 text-[10px]">
              배경
            </span>
            {BG_COLORS.map((c) => (
              <Swatch
                key={c.value}
                color={c}
                size="size-5"
                onClick={() => {
                  editor.chain().focus().setBackgroundColor(c.value).run();
                  setMode("menu");
                }}
              />
            ))}
            <BubbleBtn
              label="배경 없음"
              onClick={() => {
                editor.chain().focus().unsetBackgroundColor().run();
                setMode("menu");
              }}
            >
              <RotateCcw className="size-3.5" />
            </BubbleBtn>
          </div>
        </div>
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
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      {TEXT_ALIGNS.map(({ value, label, Icon }) => (
        <BubbleBtn
          key={value}
          label={label}
          active={editor.isActive({ textAlign: value })}
          onClick={() => editor.chain().focus().setTextAlign(value).run()}
        >
          <Icon className="size-4" />
        </BubbleBtn>
      ))}
    </div>
  );
}
