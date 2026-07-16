"use client";

// 슬래시 커맨드(/) 메뉴. '/' 입력 시 블록 삽입 커맨드 목록을 띄우고, 선택하면
// 슬래시 텍스트 범위를 지우고 해당 블록을 삽입한다. 티켓/사람 멘션과 동일한
// @tiptap/suggestion 패턴을 쓰되, 서버 검색이 아니라 고정 커맨드 목록을 필터한다.
// 확장 배선은 slash-command.ts, 여기서는 커맨드 정의 + 드롭다운 UI 를 담당한다.

import {
  forwardRef,
  useImperativeHandle,
  useState,
  type ComponentType,
  type ForwardedRef,
} from "react";
import type { Editor, Range } from "@tiptap/core";
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Table as TableIcon,
  Workflow,
  Minus,
  type LucideIcon,
} from "lucide-react";
import type {
  SuggestionProps,
  SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import { cn } from "@/lib/utils";

export type SlashItem = {
  title: string;
  subtitle: string;
  aliases: string[];
  icon: ComponentType<{ className?: string }>;
  run: (editor: Editor, range: Range) => void;
};

// deleteRange 로 '/query' 를 지운 뒤 해당 블록 커맨드를 실행한다.
function make(
  title: string,
  subtitle: string,
  aliases: string[],
  icon: LucideIcon,
  cmd: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>,
): SlashItem {
  return {
    title,
    subtitle,
    aliases,
    icon,
    run: (editor, range) =>
      cmd(editor.chain().focus().deleteRange(range)).run(),
  };
}

export const SLASH_ITEMS: SlashItem[] = [
  make("제목 1", "큰 제목", ["h1", "heading1", "제목1"], Heading1, (c) =>
    c.setNode("heading", { level: 1 }),
  ),
  make("제목 2", "중간 제목", ["h2", "heading2", "제목2"], Heading2, (c) =>
    c.setNode("heading", { level: 2 }),
  ),
  make("제목 3", "작은 제목", ["h3", "heading3", "제목3"], Heading3, (c) =>
    c.setNode("heading", { level: 3 }),
  ),
  make("제목 4", "더 작은 제목", ["h4", "heading4", "제목4"], Heading4, (c) =>
    c.setNode("heading", { level: 4 }),
  ),
  make("제목 5", "더 작은 제목", ["h5", "heading5", "제목5"], Heading5, (c) =>
    c.setNode("heading", { level: 5 }),
  ),
  make("제목 6", "가장 작은 제목", ["h6", "heading6", "제목6"], Heading6, (c) =>
    c.setNode("heading", { level: 6 }),
  ),
  make(
    "글머리 목록",
    "• 순서 없는 목록",
    ["bullet", "ul", "list", "글머리", "목록"],
    List,
    (c) => c.toggleBulletList(),
  ),
  make(
    "번호 목록",
    "1. 순서 있는 목록",
    ["number", "ol", "ordered", "번호"],
    ListOrdered,
    (c) => c.toggleOrderedList(),
  ),
  make(
    "체크리스트",
    "할 일 목록",
    ["todo", "task", "check", "체크", "할일"],
    ListChecks,
    (c) => c.toggleTaskList(),
  ),
  make("인용", "인용문 블록", ["quote", "blockquote", "인용"], Quote, (c) =>
    c.toggleBlockquote(),
  ),
  make("코드 블록", "구문 강조 코드", ["code", "코드"], Code, (c) =>
    c.toggleCodeBlock(),
  ),
  make("표", "3×3 표 삽입", ["table", "표"], TableIcon, (c) =>
    c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
  ),
  make(
    "다이어그램",
    "mermaid 차트",
    ["mermaid", "diagram", "chart", "다이어그램"],
    Workflow,
    (c) => c.insertContent({ type: "mermaidBlock" }),
  ),
  make("구분선", "가로 구분선", ["divider", "hr", "구분선", "선"], Minus, (c) =>
    c.setHorizontalRule(),
  ),
];

// 공백으로 시작하는 '/' 는 슬래시 커맨드로 취급하지 않도록 query 를 trim 해서 매칭.
export function filterSlashItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter(
    (it) =>
      it.title.toLowerCase().includes(q) ||
      it.aliases.some((a) => a.toLowerCase().includes(q)),
  );
}

export type SlashMenuHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

export const SlashMenu = forwardRef(function SlashMenu(
  props: SuggestionProps<SlashItem, SlashItem>,
  ref: ForwardedRef<SlashMenuHandle>,
) {
  const [selected, setSelected] = useState(0);
  const items = props.items;

  // items 가 바뀌면 선택을 0 으로 리셋(멘션 목록과 동일: 렌더 중 이전값 비교).
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setSelected(0);
  }

  function pick(index: number) {
    const item = items[index];
    if (item) props.command(item);
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (items.length === 0) return false;
      if (event.key === "ArrowUp") {
        setSelected((s) => (s + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        pick(selected);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="bg-popover text-popover-foreground ring-foreground/10 z-50 w-64 rounded-lg p-1 shadow-md ring-1">
        <div className="text-muted-foreground px-2 py-3 text-center text-sm">
          일치하는 커맨드가 없습니다
        </div>
      </div>
    );
  }

  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 z-50 max-h-72 w-64 overflow-y-auto rounded-lg p-1 shadow-md ring-1">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              pick(i);
            }}
            onMouseEnter={() => setSelected(i)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm",
              i === selected ? "bg-muted text-foreground" : "text-foreground",
            )}
          >
            <span className="bg-card border-border text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md border">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{item.title}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {item.subtitle}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
});
