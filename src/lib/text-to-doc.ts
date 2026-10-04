import type { JSONContent } from "@tiptap/core";

type Node = JSONContent;

/** Parse inline markdown (bold/italic/code/link) into an array of Tiptap text nodes. */
export function inlineToNodes(text: string): Node[] {
  if (!text) return [];
  // Ordered so bold/code win over single-char emphasis; links last.
  const pattern =
    /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\*([^*]+)\*)|(_([^_]+)_)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  const nodes: Node[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last)
      nodes.push({ type: "text", text: text.slice(last, m.index) });
    if (m[2] !== undefined) {
      nodes.push({ type: "text", text: m[2], marks: [{ type: "bold" }] });
    } else if (m[4] !== undefined) {
      nodes.push({ type: "text", text: m[4], marks: [{ type: "code" }] });
    } else if (m[6] !== undefined) {
      nodes.push({ type: "text", text: m[6], marks: [{ type: "italic" }] });
    } else if (m[8] !== undefined) {
      nodes.push({ type: "text", text: m[8], marks: [{ type: "italic" }] });
    } else if (m[10] !== undefined && m[11] !== undefined) {
      nodes.push({
        type: "text",
        text: m[10],
        marks: [{ type: "link", attrs: { href: m[11] } }],
      });
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes;
}

function paragraph(text: string): Node {
  const content = inlineToNodes(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

// 블록 문법. 여기서 판별하지 못한 줄은 문단이 되므로, 위키가 그릴 수 있는 블록은 모두
// 이 목록에 있어야 한다(없으면 `| a | b |` 같은 문법이 글자로 남아 깨져 보인다).
const FENCE_OPEN = /^\s*```\s*([\w+#-]*)\s*$/;
const FENCE_CLOSE = /^\s*```\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)\d+[.)]\s+(.*)$/;
const TASK = /^\[([ xX])\]\s+(.*)$/;
const TABLE_ROW = /^\s*\|/;
const TABLE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/;

const indentOf = (line: string) => line.match(/^\s*/)![0].length;
const isTableStart = (lines: string[], i: number) =>
  TABLE_ROW.test(lines[i]) && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]);

function isBlockStart(lines: string[], i: number): boolean {
  const l = lines[i];
  return (
    FENCE_OPEN.test(l) ||
    HEADING.test(l) ||
    HR.test(l) ||
    QUOTE.test(l) ||
    BULLET.test(l) ||
    ORDERED.test(l) ||
    isTableStart(lines, i)
  );
}

/** `| a | b |` 한 줄을 칸 문자열로. `\|` 는 칸 안의 글자. */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  // ponytail: 인라인 코드 안의 | 도 구분자로 본다 — 필요하면 백틱 구간을 건너뛰는 분리로.
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

/** 헤더 행 + 구분 행 + 본문 행 → 표. 칸 수는 헤더 기준으로 맞춘다(모자라면 빈 칸). */
function table(header: string[], rows: string[][]): Node {
  const row = (cells: string[], type: "tableHeader" | "tableCell"): Node => ({
    type: "tableRow",
    content: header.map((_, k) => ({ type, content: [paragraph(cells[k] ?? "")] })),
  });
  return {
    type: "table",
    content: [row(header, "tableHeader"), ...rows.map((r) => row(r, "tableCell"))],
  };
}

/** 같은 들여쓰기의 목록 항목들 + 그보다 깊게 들여쓴 하위 줄(중첩 목록·문단)을 한 목록으로. */
function list(lines: string[], start: number): [Node, number] {
  const ordered = !BULLET.test(lines[start]);
  const marker = ordered ? ORDERED : BULLET;
  const indent = indentOf(lines[start]);
  // 체크 항목 여부가 바뀌면 목록을 나눈다(글머리 목록 뒤의 `- [ ]` 가 글자로 흡수되지 않게).
  const isTask = (l: string) => !ordered && TASK.test(l.match(marker)?.[2] ?? "");
  const task = isTask(lines[start]);
  const sameList = (l: string) =>
    indentOf(l) === indent && marker.test(l) && isTask(l) === task;
  const items: { text: string; children: string[] }[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      // 빈 줄 뒤에 같은 목록 항목이나 하위 줄이 이어지면 목록을 계속한다.
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && indentOf(lines[j]) > indent && items.length) {
        items[items.length - 1].children.push("");
        i = j;
        continue;
      }
      if (j < lines.length && sameList(lines[j])) {
        i = j;
        continue;
      }
      break;
    }
    if (sameList(line)) {
      items.push({ text: line.match(marker)![2], children: [] });
    } else if (indentOf(line) > indent && items.length) {
      items[items.length - 1].children.push(line);
    } else {
      break; // 다른 종류의 목록이거나 바깥 들여쓰기 → 이 목록은 끝
    }
    i++;
  }

  const content = items.map(({ text, children }) => {
    const t = task ? text.match(TASK) : null;
    const body = [paragraph(t ? t[2] : text), ...parseBlocks(dedent(children))];
    return task
      ? { type: "taskItem", attrs: { checked: !!t && t[1] !== " " }, content: body }
      : { type: "listItem", content: body };
  });
  return [{ type: task ? "taskList" : ordered ? "orderedList" : "bulletList", content }, i];
}

function dedent(lines: string[]): string[] {
  const depth = Math.min(
    ...lines.filter((l) => l.trim()).map(indentOf),
    Number.MAX_SAFE_INTEGER,
  );
  return lines.map((l) => l.slice(Math.min(depth, indentOf(l))));
}

function parseBlocks(lines: string[]): Node[] {
  const content: Node[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block. mermaid 는 다이어그램 블록(mermaidBlock)으로 그린다.
    const fence = line.match(FENCE_OPEN);
    if (fence) {
      const lang = fence[1] || null;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !FENCE_CLOSE.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const code = buf.join("\n");
      if (lang === "mermaid") {
        content.push({ type: "mermaidBlock", attrs: { code } });
      } else {
        content.push({
          type: "codeBlock",
          attrs: { language: lang },
          // 빈 텍스트 노드는 ProseMirror 가 거부한다.
          ...(code ? { content: [{ type: "text", text: code }] } : {}),
        });
      }
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: inlineToNodes(heading[2].trim()),
      });
      i++;
      continue;
    }

    if (HR.test(line)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(lines[i]);
      const rows: string[][] = [];
      i += 2; // 헤더 + 구분 행
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      content.push(table(header, rows));
      continue;
    }

    if (QUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        buf.push(lines[i].match(QUOTE)![1]);
        i++;
      }
      const inner = parseBlocks(buf);
      content.push({ type: "blockquote", content: inner.length ? inner : [paragraph("")] });
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const [node, next] = list(lines, i);
      content.push(node);
      i = next;
      continue;
    }

    // Paragraph: gather consecutive non-blank lines until another block starts
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines, i)) {
      buf.push(lines[i].trim());
      i++;
    }
    content.push(paragraph(buf.join(" ")));
  }
  return content;
}

/**
 * Convert markdown to a Tiptap doc JSON. Safe for LLM-authored wiki bodies.
 * 지원: 제목, 문단, 굵게·기울임·코드·링크, 글머리·번호·체크 목록(들여쓰기 중첩), 인용,
 * 구분선, 파이프 표, 코드 펜스, ```mermaid 다이어그램.
 */
export function markdownToDoc(md: string): Node {
  const src = (md ?? "").replace(/\r\n/g, "\n").trim();
  if (!src) return { type: "doc", content: [{ type: "paragraph" }] };
  const content = parseBlocks(src.split("\n"));
  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}
