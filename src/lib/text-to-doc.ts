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

function listItems(lines: string[], strip: RegExp): Node[] {
  return lines.map((l) => ({
    type: "listItem",
    content: [paragraph(l.replace(strip, ""))],
  }));
}

/** Convert a markdown subset to a Tiptap doc JSON. Safe for LLM-authored wiki bodies. */
export function markdownToDoc(md: string): Node {
  const src = (md ?? "").replace(/\r\n/g, "\n").trim();
  if (!src) return { type: "doc", content: [{ type: "paragraph" }] };

  const content: Node[] = [];
  const lines = src.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      const lang = fence[1] ?? null;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      content.push({
        type: "codeBlock",
        attrs: { language: lang },
        content: [{ type: "text", text: buf.join("\n") }],
      });
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: inlineToNodes(heading[2].trim()),
      });
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      content.push({ type: "bulletList", content: listItems(buf, /^[-*]\s+/) });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      content.push({ type: "orderedList", content: listItems(buf, /^\d+\.\s+/) });
      continue;
    }

    // Paragraph: gather consecutive non-blank, non-special lines
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    content.push(paragraph(buf.join(" ")));
  }

  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  };
}
