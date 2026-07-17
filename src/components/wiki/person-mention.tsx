"use client";

// 사람/팀 멘션 '@'(B5). Tiptap suggestion(트리거 '@')로 멤버·팀을 함께 검색해
// 인라인 멘션 칩(personMention/teamMention 노드)을 삽입한다. 사람 칩 클릭 시
// /users/<id> 프로필로 이동. 팀 멘션은 저장 시 팀원 전원에게 알림이 확장된다.
//
// #4 티켓 멘션(ticket-mention.tsx)과 동일 패턴의 자기완결 모듈로, extensions.ts
// 배열에 PersonMention 한 줄만 추가하면 된다(teamMention 노드는 team-mention.tsx).
// 같은 '@' 문자에 Suggestion 플러그인을 두 개 둘 수 없어 팀 항목도 이 모듈의
// suggestion 이 함께 노출한다.

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
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { searchMentionTargetsAction } from "@/server/actions/wiki";

export type PersonItem =
  | {
      kind: "person";
      id: string;
      label: string; // 표시 이름
      email: string;
      team: string | null; // 팀명
    }
  | {
      kind: "team";
      id: string;
      label: string; // 팀명
      teamKey: string; // 이슈 key 접두어("DESIGN")
      memberCount: number;
    };

const personSuggestionKey = new PluginKey("personMention");

// ---------- 인라인 칩 노드뷰 ----------

function PersonChip({ node }: NodeViewProps) {
  const router = useRouter();
  const id = node.attrs.id as string | null;
  const label = (node.attrs.label as string | null) ?? "";
  const href = id ? `/users/${id}` : undefined;

  return (
    <NodeViewWrapper as="span" className="inline">
      <a
        href={href}
        data-person-mention=""
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          if (id) router.push(`/users/${id}`);
        }}
        className="text-link hover:bg-accent inline-flex cursor-pointer items-center rounded px-0.5 align-baseline text-[0.95em] leading-none font-medium no-underline transition-colors"
      >
        @{label}
      </a>
    </NodeViewWrapper>
  );
}

// ---------- 검색 드롭다운 ----------

type PersonListHandle = { onKeyDown: (props: SuggestionKeyDownProps) => boolean };

const PersonSuggestionList = forwardRef(function PersonSuggestionList(
  props: SuggestionProps<PersonItem, PersonItem>,
  ref: ForwardedRef<PersonListHandle>,
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
          일치하는 사용자/팀이 없습니다
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
            {item.kind === "team" ? (
              <>
                <Users className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  팀 전체 · {item.memberCount}명
                </span>
              </>
            ) : (
              <>
                <span className="truncate">{item.label}</span>
                {item.team && (
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {item.team}
                  </span>
                )}
              </>
            )}
          </button>
        ))
      )}
    </div>
  );
});

// ---------- 노드 + suggestion 확장 ----------

export const PersonMention = Node.create({
  name: "personMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-person-id"),
        renderHTML: (attrs) =>
          attrs.id ? { "data-person-id": attrs.id as string } : {},
      },
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-person-label"),
        renderHTML: (attrs) =>
          attrs.label ? { "data-person-label": attrs.label as string } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-person-mention]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const id = node.attrs.id as string | null;
    return [
      "a",
      mergeAttributes(
        {
          "data-person-mention": "",
          href: id ? `/users/${id}` : "#",
          class: "person-mention",
        },
        HTMLAttributes,
      ),
      `@${node.attrs.label ?? ""}`,
    ];
  },

  renderText({ node }) {
    return `@${(node.attrs.label as string | null) ?? ""}`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(PersonChip);
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<PersonItem, PersonItem>({
        editor: this.editor,
        char: "@",
        pluginKey: personSuggestionKey,
        debounce: 150,
        // 코드블록 안에서는 '@' 를 사람 멘션 트리거로 쓰지 않는다(팝업 미표시).
        allow: ({ state, range }) =>
          state.doc.resolve(range.from).parent.type.name !== "codeBlock",
        items: async ({ query }) => {
          const { users, teams } = await searchMentionTargetsAction(query);
          // 팀을 위에(소수), 멤버를 아래에. 팀 멘션은 전원 알림이라 눈에 띄게 구분한다.
          return [
            ...teams.map(
              (t): PersonItem => ({
                kind: "team",
                id: t.id,
                label: t.name,
                teamKey: t.key,
                memberCount: t._count.members,
              }),
            ),
            ...users.map(
              (u): PersonItem => ({
                kind: "person",
                id: u.id,
                label: u.name ?? u.email,
                email: u.email,
                team: u.team?.name ?? null,
              }),
            ),
          ];
        },
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: props.kind === "team" ? "teamMention" : "personMention",
                attrs: { id: props.id, label: props.label },
              },
              { type: "text", text: " " },
            ])
            .run();
        },
        render: () => {
          let component: ReactRenderer<PersonListHandle> | null = null;
          let unmount: (() => void) | undefined;

          return {
            onStart: (props) => {
              component = new ReactRenderer(PersonSuggestionList, {
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
