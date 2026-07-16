"use client";

// 슬래시 커맨드(/) 메뉴 UI. '/' 입력 시 블록 삽입 커맨드 목록을 띄우고, 선택하면
// 슬래시 텍스트 범위를 지우고 해당 블록을 삽입한다. 커맨드 메타데이터·필터는 순수
// 모듈(slash-commands.ts)에 있고, 여기선 key 로 아이콘(lucide)·실행(editor 클로저)을
// 결합해 렌더한다. 확장 배선은 slash-command.ts.

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
import {
  SLASH_COMMANDS,
  filterByQuery,
  type SlashCommandMeta,
} from "@/components/wiki/slash-commands";

export type SlashItem = SlashCommandMeta & {
  icon: ComponentType<{ className?: string }>;
  run: (editor: Editor, range: Range) => void;
};

// key → 아이콘. 순수 메타(slash-commands)와 분리해 UI 의존(lucide)을 여기 가둔다.
const ICONS: Record<string, LucideIcon> = {
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  h4: Heading4,
  h5: Heading5,
  h6: Heading6,
  bullet: List,
  ordered: ListOrdered,
  task: ListChecks,
  quote: Quote,
  code: Code,
  table: TableIcon,
  mermaid: Workflow,
  divider: Minus,
};

// key → 실행. deleteRange(range) 로 '/query' 를 지운 뒤 해당 블록 커맨드를 실행한다.
function runFor(key: string) {
  return (editor: Editor, range: Range) => {
    const chain = editor.chain().focus().deleteRange(range);
    const heading = /^h([1-6])$/.exec(key);
    if (heading) {
      chain.setNode("heading", { level: Number(heading[1]) });
    } else {
      switch (key) {
        case "bullet":
          chain.toggleBulletList();
          break;
        case "ordered":
          chain.toggleOrderedList();
          break;
        case "task":
          chain.toggleTaskList();
          break;
        case "quote":
          chain.toggleBlockquote();
          break;
        case "code":
          chain.toggleCodeBlock();
          break;
        case "table":
          chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
          break;
        case "mermaid":
          chain.insertContent({ type: "mermaidBlock" });
          break;
        case "divider":
          chain.setHorizontalRule();
          break;
      }
    }
    chain.run();
  };
}

// 순수 메타 + 아이콘 + 실행을 key 로 결합한 런타임 아이템.
const SLASH_ITEMS: SlashItem[] = SLASH_COMMANDS.map((meta) => ({
  ...meta,
  icon: ICONS[meta.key],
  run: runFor(meta.key),
}));

export function filterSlashItems(query: string): SlashItem[] {
  return filterByQuery(SLASH_ITEMS, query);
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
            key={item.key}
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
