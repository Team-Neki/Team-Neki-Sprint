"use client";

// 위키 페이지 멘션. '@' suggestion(person-mention.tsx)이 사람·팀과 함께 위키
// 페이지도 노출하고, 선택 시 이 wikiMention 노드를 삽입한다. 칩 클릭 시
// /wiki/<id> 로 이동. 티켓 멘션(ticket-mention.tsx)과 동일한 인라인 칩 구조지만
// 자체 Suggestion 은 없다(같은 '@' 트리거는 PersonMention 하나만 소유).

import { useRouter } from "next/navigation";
import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { FileText } from "lucide-react";

// ---------- 인라인 칩 노드뷰 ----------

function WikiChip({ node }: NodeViewProps) {
  const router = useRouter();
  const id = node.attrs.id as string | null;
  const label = (node.attrs.label as string | null) ?? "";
  const href = id ? `/wiki/${id}` : undefined;

  return (
    <NodeViewWrapper as="span" className="inline">
      <a
        href={href}
        data-wiki-mention=""
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          if (id) router.push(`/wiki/${id}`);
        }}
        className="border-border bg-muted text-foreground hover:bg-accent hover:text-accent-foreground inline-flex cursor-pointer items-center gap-0.5 rounded-md border px-1 py-px align-baseline text-[0.85em] leading-none no-underline transition-colors"
      >
        <FileText className="mr-0.5 inline size-3" />
        {label}
      </a>
    </NodeViewWrapper>
  );
}

// ---------- 노드 확장 ----------

export const WikiMention = Node.create({
  name: "wikiMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-wiki-id"),
        renderHTML: (attrs) =>
          attrs.id ? { "data-wiki-id": attrs.id as string } : {},
      },
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-wiki-label"),
        renderHTML: (attrs) =>
          attrs.label ? { "data-wiki-label": attrs.label as string } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-wiki-mention]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const id = node.attrs.id as string | null;
    return [
      "a",
      mergeAttributes(
        {
          "data-wiki-mention": "",
          href: id ? `/wiki/${id}` : "#",
          class: "wiki-mention",
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
    return ReactNodeViewRenderer(WikiChip);
  },
});
