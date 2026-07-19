"use client";

// 위키 본문 파일 첨부. 툴바 '파일 첨부'(editor.tsx)가 업로드 후 이 fileAttachment
// 노드를 삽입한다. 다운로드 가능한 칩(클립 아이콘 + 파일명 + 사람이 읽는 크기)을
// 렌더하며, 링크는 GET /api/wiki/file/<id>(항상 attachment 로 서빙)로 향한다.
// 편집/뷰가 확장을 공유하므로 두 모드 모두에서 동일하게 칩으로 보인다.
// 속성 (de)serialization 은 wiki-mention.tsx 와 동일한 data-* 방식.

import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { Paperclip } from "lucide-react";

/** 바이트 크기를 사람이 읽기 좋은 문자열로(예: 1.2 MB). 알 수 없으면 빈 문자열. */
function humanizeSize(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  // B 는 소수 없이, 그 외 단위는 소수 1자리.
  const rounded = i === 0 ? n : Math.round(n * 10) / 10;
  return `${rounded} ${units[i]}`;
}

// ---------- 다운로드 칩 노드뷰 ----------

function FileChip({ node }: NodeViewProps) {
  const id = node.attrs.id as string | null;
  const name = (node.attrs.name as string | null) ?? "첨부파일";
  const size = node.attrs.size as number | null;
  const href = id ? `/api/wiki/file/${id}` : undefined;
  const humanSize = humanizeSize(size);

  return (
    <NodeViewWrapper className="wiki-file-block" data-drag-handle>
      <a
        href={href}
        download
        data-wiki-file={id ?? ""}
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        className="border-border bg-muted text-foreground hover:bg-accent hover:text-accent-foreground inline-flex max-w-full cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 align-baseline text-sm no-underline transition-colors"
      >
        <Paperclip className="size-4 shrink-0" />
        <span className="truncate font-medium">{name}</span>
        {humanSize && (
          <span className="text-muted-foreground shrink-0 text-xs">
            {humanSize}
          </span>
        )}
      </a>
    </NodeViewWrapper>
  );
}

// ---------- 노드 확장 ----------

export const WikiFileAttachment = Node.create({
  name: "fileAttachment",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-wiki-file"),
        renderHTML: (attrs) =>
          attrs.id ? { "data-wiki-file": attrs.id as string } : {},
      },
      name: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-file-name"),
        renderHTML: (attrs) =>
          attrs.name ? { "data-file-name": attrs.name as string } : {},
      },
      size: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute("data-file-size");
          if (!raw) return null;
          const n = Number(raw);
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: (attrs) =>
          attrs.size != null ? { "data-file-size": String(attrs.size) } : {},
      },
      mime: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-file-mime"),
        renderHTML: (attrs) =>
          attrs.mime ? { "data-file-mime": attrs.mime as string } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-wiki-file]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const id = node.attrs.id as string | null;
    return [
      "a",
      mergeAttributes(
        {
          "data-wiki-file": id ?? "",
          href: id ? `/api/wiki/file/${id}` : "#",
          download: "",
          class: "wiki-file",
        },
        HTMLAttributes,
      ),
      `${node.attrs.name ?? ""}`,
    ];
  },

  renderText({ node }) {
    return (node.attrs.name as string | null) ?? "";
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileChip);
  },
});
