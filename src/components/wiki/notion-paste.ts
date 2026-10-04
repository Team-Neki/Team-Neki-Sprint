// Notion 에서 블록을 복사해 붙여넣을 때 남는 흔적 정리(ProseMirror transformPasted).
// Notion 클립보드 HTML 은 두 가지를 Sprint 가 그릴 수 없는 모양으로 준다.
// 1) 업로드한 이미지·파일: <img src="attachment:<uuid>:<파일명>"> — Notion 안에서만 통하는
//    참조라 브라우저가 불러올 수 없어 깨진 이미지가 된다. 원본 파일은 클립보드에 없다.
// 2) 콜아웃: "<aside>" · "</aside>" 가 태그가 아니라 글자로 들어와 앞뒤 문단으로 남는다.
// 그래서 (1) 은 빼고(개수를 돌려 안내), (2) 는 표시 문단 사이를 인용 블록으로 감싼다.
// 최상위 DOM 접근이 없어 Node 환경 단위 테스트가 가능하다.

import { Fragment, Slice, type Node } from "@tiptap/pm/model";

const ASIDE_OPEN = "<aside>";
const ASIDE_CLOSE = "</aside>";
// 콜아웃 첫 줄이 아이콘 하나뿐이면 다음 문단 앞에 붙인다(따로 한 줄을 차지하지 않게).
const ICON_ONLY = /^\p{Extended_Pictographic}️?$/u;

/** 브라우저가 불러올 수 있는 이미지 src — 업로드 경로(/api/wiki/image/...) 같은 상대 경로와 http(s). */
export function isLoadableImageSrc(src: unknown): boolean {
  return typeof src === "string" && /^(\/|https?:\/\/)/i.test(src);
}

const isParagraph = (n: Node) => n.type.name === "paragraph";
const opensAside = (n: Node) =>
  isParagraph(n) && n.textContent.trimStart().startsWith(ASIDE_OPEN);
const closesAside = (n: Node) =>
  isParagraph(n) && n.textContent.trimEnd().endsWith(ASIDE_CLOSE);

function children(frag: Fragment): Node[] {
  const out: Node[] = [];
  frag.forEach((n) => out.push(n));
  return out;
}

/** 문단 첫 텍스트에서 시작 표시를 지우고, 바로 뒤 줄바꿈도 지운다. */
function stripOpen(p: Node): Node {
  const inline = children(p.content);
  const first = inline[0];
  if (!first?.isText) return p;
  const rest = first.text!.trimStart().slice(ASIDE_OPEN.length).trimStart();
  const head = rest ? [first.type.schema.text(rest, first.marks)] : [];
  const tail = inline.slice(1);
  if (!rest && tail[0]?.type.name === "hardBreak") tail.shift();
  return p.copy(Fragment.fromArray([...head, ...tail]));
}

/** 문단 마지막 텍스트에서 끝 표시를 지운다. */
function stripClose(p: Node): Node {
  const inline = children(p.content);
  const last = inline[inline.length - 1];
  if (!last?.isText) return p;
  const rest = last.text!.trimEnd().slice(0, -ASIDE_CLOSE.length).trimEnd();
  const head = inline.slice(0, -1);
  return p.copy(
    Fragment.fromArray(rest ? [...head, last.type.schema.text(rest, last.marks)] : head),
  );
}

/** <aside> 문단 ~ </aside> 문단을 인용 블록 하나로. 감쌀 내용이 없으면 null. */
function toQuote(blocks: Node[]): Node | null {
  const quote = blocks[0].type.schema.nodes.blockquote;
  if (!quote) return null;
  const inner = [...blocks];
  inner[0] = stripOpen(inner[0]);
  inner[inner.length - 1] = stripClose(inner[inner.length - 1]);
  const icon = inner[0].textContent.trim();
  if (ICON_ONLY.test(icon) && inner[1] && isParagraph(inner[1])) {
    const schema = inner[0].type.schema;
    inner.splice(0, 2, inner[1].copy(Fragment.from(schema.text(`${icon} `)).append(inner[1].content)));
  }
  const kept = inner.filter((n) => !(isParagraph(n) && n.content.size === 0));
  return kept.length ? quote.create(null, kept) : null;
}

/**
 * 붙여넣은 slice 에서 Notion 첨부 이미지를 빼고 콜아웃 표시를 인용 블록으로 바꾼다.
 * 바꾼 것이 없으면 받은 slice 를 그대로 돌려준다(일반 붙여넣기 동작 불변).
 */
export function cleanNotionPaste(slice: Slice): { slice: Slice; dropped: number } {
  let dropped = 0;

  // 바뀐 것이 없으면 같은 Fragment 인스턴스를 돌려줘 상위가 복사하지 않게 한다.
  function clean(frag: Fragment): Fragment {
    const kids = children(frag);
    const out: Node[] = [];
    let changed = false;
    for (let i = 0; i < kids.length; i++) {
      const node = kids[i];
      if (node.type.name === "image" && !isLoadableImageSrc(node.attrs.src)) {
        dropped++;
        changed = true;
        continue;
      }
      if (opensAside(node)) {
        const end = kids.findIndex((k, j) => j >= i && closesAside(k));
        if (end !== -1) {
          // 표시를 먼저 벗긴 뒤 안쪽만 다시 정리한다(그대로 넘기면 같은 시작 표시를 또 만나 무한 재귀).
          const quote = toQuote(kids.slice(i, end + 1));
          const inner = quote ? clean(quote.content) : Fragment.empty;
          if (quote && inner.size) out.push(quote.copy(inner));
          changed = true;
          i = end;
          continue;
        }
      }
      if (node.isTextblock || node.isLeaf) {
        out.push(node);
        continue;
      }
      const content = clean(node.content);
      if (content !== node.content) changed = true;
      out.push(content === node.content ? node : node.copy(content));
    }
    return changed ? Fragment.fromArray(out) : frag;
  }

  const content = clean(slice.content);
  if (content === slice.content) return { slice, dropped };
  if (content.size === 0) return { slice: Slice.empty, dropped };
  // 맨 앞·뒤 노드가 바뀌었으면 그쪽을 닫는다 — 열린 채로 두면 감싼 인용 블록이 붙여넣는
  // 자리의 문단과 합쳐져 풀릴 수 있다. 그대로면 원래 열림(같은 줄 이어 붙이기)을 유지.
  const openStart = content.firstChild === slice.content.firstChild ? slice.openStart : 0;
  const openEnd = content.lastChild === slice.content.lastChild ? slice.openEnd : 0;
  return { slice: new Slice(content, openStart, openEnd), dropped };
}
