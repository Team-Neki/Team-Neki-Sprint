"use client";

// #4 에디터 내 티켓/위키 링크. Tiptap suggestion(트리거 '#')로 티켓과 위키
// 페이지를 함께 검색해 인라인 칩을 삽입한다. 티켓은 ticketMention 노드(칩 클릭 시
// /tasks/<id>), 위키 페이지는 wikiMention 노드(칩 클릭 시 /wiki/<id>)로 삽입된다.
//
// 이 모듈은 editor.tsx가 확장 하나만 추가하면 되도록 자기완결적으로 구성했다.
// '@' 사람·팀 멘션은 동일 패턴의 별도 모듈(person-mention)이며, 여기 로직과
// 겹치지 않는다(위키 페이지 멘션은 '@' 에서 '#' 로 이관됨).

import {
  forwardRef,
  useImperativeHandle,
  useState,
  type ForwardedRef,
} from "react";
import { useRouter } from "next/navigation";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactRenderer,
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, {
  type SuggestionProps,
  type SuggestionKeyDownProps,
} from "@tiptap/suggestion";
import type { Status } from "@prisma/client";
import { FileText } from "lucide-react";
import { STATUS_META, formatIssueKey } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { searchTasksAction, searchWikiPagesAction } from "@/server/actions/wiki";

// '#' suggestion 은 티켓과 위키 페이지를 함께 노출한다(티켓 먼저, 위키 나중).
// 티켓 선택 → ticketMention 노드, 위키 선택 → wikiMention 노드(링크 칩).
export type TicketItem =
  | { kind: "ticket"; id: string; label: string; title: string; status: Status }
  | { kind: "wiki"; id: string; label: string }; // label = 페이지 제목

const ticketSuggestionKey = new PluginKey("ticketMention");

// ---------- 인라인 칩 노드뷰 ----------

function TicketChip({ node }: NodeViewProps) {
  const router = useRouter();
  const id = node.attrs.id as string | null;
  const label = (node.attrs.label as string | null) ?? "";
  const href = id ? `/tasks/${id}` : undefined;

  return (
    <NodeViewWrapper as="span" className="inline">
      <a
        href={href}
        data-ticket-mention=""
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          if (id) router.push(`/tasks/${id}`);
        }}
        className="border-border bg-muted text-foreground hover:bg-accent hover:text-accent-foreground inline-flex cursor-pointer items-center rounded-md border px-1 py-px align-baseline font-mono text-[0.8em] leading-none no-underline transition-colors"
      >
        {label}
      </a>
    </NodeViewWrapper>
  );
}

// ---------- 검색 드롭다운 ----------

type TicketListHandle = { onKeyDown: (props: SuggestionKeyDownProps) => boolean };

const TicketSuggestionList = forwardRef(function TicketSuggestionList(
  props: SuggestionProps<TicketItem, TicketItem>,
  ref: ForwardedRef<TicketListHandle>,
) {
  const [selected, setSelected] = useState(0);
  const items = props.items;

  // items가 바뀌면 선택을 0으로 리셋. effect 대신 렌더 중 이전값 비교 패턴 사용.
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

  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 z-50 max-h-72 w-72 overflow-y-auto rounded-lg p-1 shadow-md ring-1">
      {props.loading ? (
        <div className="text-muted-foreground px-2 py-3 text-center text-sm">
          검색 중…
        </div>
      ) : items.length === 0 ? (
        <div className="text-muted-foreground px-2 py-3 text-center text-sm">
          일치하는 티켓/위키가 없습니다
        </div>
      ) : (
        items.map((item, i) => (
          <button
            key={`${item.kind}:${item.id}`}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              pick(i);
            }}
            onMouseEnter={() => setSelected(i)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
              i === selected ? "bg-muted text-foreground" : "text-foreground",
            )}
          >
            {item.kind === "wiki" ? (
              <>
                <FileText className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </>
            ) : (
              <>
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    STATUS_META[item.status].dot,
                  )}
                />
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                  {item.label}
                </span>
                <span className="truncate">{item.title}</span>
              </>
            )}
          </button>
        ))
      )}
    </div>
  );
});

// ---------- 노드 + suggestion 확장 ----------

export const TicketMention = Node.create({
  name: "ticketMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-ticket-id"),
        renderHTML: (attrs) =>
          attrs.id ? { "data-ticket-id": attrs.id as string } : {},
      },
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-ticket-label"),
        renderHTML: (attrs) =>
          attrs.label ? { "data-ticket-label": attrs.label as string } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-ticket-mention]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const id = node.attrs.id as string | null;
    return [
      "a",
      mergeAttributes(
        {
          "data-ticket-mention": "",
          href: id ? `/tasks/${id}` : "#",
          class: "ticket-mention",
        },
        HTMLAttributes,
      ),
      `${node.attrs.label ?? ""}`,
    ];
  },

  renderText({ node }) {
    return (node.attrs.label as string | null) ?? "";
  },

  addNodeView() {
    return ReactNodeViewRenderer(TicketChip);
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<TicketItem, TicketItem>({
        editor: this.editor,
        char: "#",
        pluginKey: ticketSuggestionKey,
        debounce: 150,
        // 코드블록 안에서는 '#' 를 티켓 멘션 트리거로 쓰지 않는다(팝업 미표시).
        allow: ({ state, range }) =>
          state.doc.resolve(range.from).parent.type.name !== "codeBlock",
        // '#' 뒤에서 검색. 티켓(제목/키 TEAM-n)과 위키 페이지(제목)를 병렬 조회해
        // 티켓을 먼저, 위키 페이지를 나중에 노출한다.
        items: async ({ query }) => {
          const [tasks, wiki] = await Promise.all([
            searchTasksAction(query),
            searchWikiPagesAction(query),
          ]);
          return [
            ...tasks.map(
              (t): TicketItem => ({
                kind: "ticket",
                id: t.id,
                label: formatIssueKey(t.team?.key, t.number),
                title: t.title,
                status: t.status,
              }),
            ),
            ...wiki.map(
              (w): TicketItem => ({
                kind: "wiki",
                id: w.id,
                label: w.title || "제목 없음",
              }),
            ),
          ];
        },
        command: ({ editor, range, props }) => {
          // 위키는 wikiMention 노드(링크 칩), 티켓은 ticketMention 노드.
          const node =
            props.kind === "wiki"
              ? {
                  type: "wikiMention",
                  attrs: { id: props.id, label: props.label },
                }
              : {
                  type: "ticketMention",
                  attrs: { id: props.id, label: props.label },
                };
          editor
            .chain()
            .focus()
            .insertContentAt(range, [node, { type: "text", text: " " }])
            .run();
        },
        render: () => {
          let component: ReactRenderer<TicketListHandle> | null = null;
          let unmount: (() => void) | undefined;

          return {
            onStart: (props) => {
              component = new ReactRenderer(TicketSuggestionList, {
                props,
                editor: props.editor,
              });
              unmount = props.mount(component.element);
            },
            onUpdate: (props) => {
              component?.updateProps(props);
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                unmount?.();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              unmount?.();
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
