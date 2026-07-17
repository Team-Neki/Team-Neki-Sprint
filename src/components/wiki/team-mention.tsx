"use client";

// 팀 멘션. '@' suggestion(person-mention.tsx)에서 팀을 고르면 이 노드(teamMention)가
// 삽입된다. 저장 시 서버가 팀원 전원으로 확장해 알림을 만든다(server/notify.ts).
// 칩 클릭 시 /teams 로 이동(팀 상세 페이지 없음 — 목록에서 확인).
//
// person-mention.tsx 의 칩 노드 부분과 동일 패턴의 자기완결 모듈로, extensions.ts
// 배열에 TeamMention 한 줄만 추가하면 된다. suggestion 은 PersonMention 이 겸한다
// ('@' 트리거 하나에 사람·팀을 함께 노출 — 같은 문자에 Suggestion 플러그인을 두 개
// 두면 충돌하므로).

import { useRouter } from "next/navigation";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Users } from "lucide-react";

function TeamChip({ node }: NodeViewProps) {
  const router = useRouter();
  const label = (node.attrs.label as string | null) ?? "";

  return (
    <NodeViewWrapper as="span" className="inline">
      <a
        href="/teams"
        data-team-mention=""
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          router.push("/teams");
        }}
        className="text-link hover:bg-accent inline-flex cursor-pointer items-center gap-0.5 rounded px-0.5 align-baseline text-[0.95em] leading-none font-medium no-underline transition-colors"
      >
        <Users className="size-[0.9em]" aria-hidden />@{label}
      </a>
    </NodeViewWrapper>
  );
}

export const TeamMention = Node.create({
  name: "teamMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-team-id"),
        renderHTML: (attrs) =>
          attrs.id ? { "data-team-id": attrs.id as string } : {},
      },
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-team-label"),
        renderHTML: (attrs) =>
          attrs.label ? { "data-team-label": attrs.label as string } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-team-mention]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(
        {
          "data-team-mention": "",
          href: "/teams",
          class: "team-mention",
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
    return ReactNodeViewRenderer(TeamChip);
  },
});
