import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import { createLowlight, common } from "lowlight";
// 코드블록 NodeView(우측 상단 복사 버튼). 구문강조는 CodeBlockLowlight 가 담당.
import { CodeBlockView } from "@/components/wiki/code-block";
// 코드블록 안 괄호/따옴표 자동 닫기(편집 모드).
import { codeBlockAutoPairs } from "@/components/wiki/code-block-pairs";
// '#' 티켓 멘션(#4) / '@' 사람 멘션(B5). 각각 자기완결 모듈, 여기 한 줄씩만 추가.
import { TicketMention } from "@/components/wiki/ticket-mention";
import { PersonMention } from "@/components/wiki/person-mention";
// 인라인 댓글 앵커(B10). 편집/뷰가 동일 스키마로 파싱해야 하므로 여기서 공유한다.
import { CommentMark } from "@/components/wiki/comment-mark";
// mermaid 다이어그램 블록(atom + NodeView, mermaid 는 지연 로드).
import { MermaidBlock } from "@/components/wiki/mermaid-block";

// 코드블록 구문 강조용 lowlight(highlight.js common 언어 세트). 모듈 1회 생성.
const lowlight = createLowlight(common);

/**
 * 위키 에디터/뷰가 공유하는 Tiptap 확장 세트. 뷰(읽기전용)와 에디터가 완전히
 * 동일한 스키마로 파싱/렌더해야 문서가 어긋나지 않으므로 한 곳에서 만든다.
 *
 * 매 호출마다 새 인스턴스 배열을 반환한다 — 하나의 확장 인스턴스를 두 에디터가
 * 공유하면 상태 충돌이 날 수 있어서다. placeholder 는 편집 모드에서만 넘긴다
 * (읽기전용 빈 문서에 "내용을 입력하세요…"가 뜨면 안 되므로).
 */
export function wikiExtensions(opts?: { placeholder?: string }) {
  return [
    // StarterKit v3 는 Link·CodeBlock 을 기본 포함하므로 끈다 — Link 는 openOnClick/
    // autolink 를 지정해 따로, CodeBlock 은 구문 강조되는 CodeBlockLowlight 로 대체한다
    // (중복 확장 경고 방지).
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: false,
      codeBlock: false,
    }),
    ...(opts?.placeholder
      ? [Placeholder.configure({ placeholder: opts.placeholder })]
      : []),
    Link.configure({ openOnClick: false, autolink: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    // 구문 강조 코드블록 + 우측 상단 복사 버튼 NodeView + 괄호/따옴표 자동 닫기.
    // 언어는 자동 감지(``` 뒤 언어 우선).
    CodeBlockLowlight.extend({
      addNodeView() {
        return ReactNodeViewRenderer(CodeBlockView);
      },
      addProseMirrorPlugins() {
        // this.parent?.() = lowlight 구문강조 플러그인 보존 + 자동 닫기 추가.
        return [
          ...(this.parent?.() ?? []),
          codeBlockAutoPairs(this.name),
        ];
      },
    }).configure({ lowlight }),
    // 표(header row 있는 리사이즈 가능 테이블).
    TableKit.configure({ table: { resizable: true } }),
    // mermaid 다이어그램 블록.
    MermaidBlock,
    // 본문 이미지. base64 금지(업로드→URL 만 허용), 서빙 URL 은 same-origin.
    Image.configure({
      allowBase64: false,
      HTMLAttributes: { class: "wiki-image" },
    }),
    TicketMention,
    PersonMention,
    CommentMark,
  ];
}
