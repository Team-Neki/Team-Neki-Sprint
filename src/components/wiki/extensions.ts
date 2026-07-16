import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { TableKit } from "@tiptap/extension-table";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import { createLowlight, common } from "lowlight";
// 코드블록 NodeView(우측 상단 복사 버튼). 구문강조는 CodeBlockLowlight 가 담당.
import { CodeBlockView } from "@/components/wiki/code-block";
// 코드블록 안 괄호/따옴표 자동 닫기 + Enter 자동 들여쓰기(편집 모드).
import {
  codeBlockAutoPairs,
  codeBlockEnterIndent,
} from "@/components/wiki/code-block-pairs";
// '#' 티켓 멘션(#4) / '@' 사람 멘션(B5). 각각 자기완결 모듈, 여기 한 줄씩만 추가.
import { TicketMention } from "@/components/wiki/ticket-mention";
import { PersonMention } from "@/components/wiki/person-mention";
// 인라인 댓글 앵커(B10). 편집/뷰가 동일 스키마로 파싱해야 하므로 여기서 공유한다.
import { CommentMark } from "@/components/wiki/comment-mark";
// mermaid 다이어그램 블록(atom + NodeView, mermaid 는 지연 로드).
import { MermaidBlock } from "@/components/wiki/mermaid-block";
// 표 편집 보조 키맵(경계에서 표 선택·삭제).
import { TableControls } from "@/components/wiki/table-controls";
// 슬래시 커맨드(/) — 블록 삽입 메뉴. 자기완결 모듈, 여기 한 줄만 추가.
import { SlashCommand } from "@/components/wiki/slash-command";

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
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: false,
      codeBlock: false,
    }),
    ...(opts?.placeholder
      ? [Placeholder.configure({ placeholder: opts.placeholder })]
      : []),
    Link.configure({ openOnClick: false, autolink: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    // 글자 색상(Color 는 TextStyle 마크에 color 속성을 얹는다). 뷰도 동일 스키마로
    // 색을 렌더해야 하므로 편집/뷰 공통으로 등록한다.
    TextStyle,
    Color,
    // 슬래시 커맨드(/) — 입력 시에만 동작(읽기전용 뷰에선 트리거 없음).
    SlashCommand,
    // 구문 강조 코드블록 + 우측 상단 복사 버튼 NodeView + 괄호/따옴표 자동 닫기.
    // 언어 미지정(Plain) 시 defaultLanguage=plaintext 로 하이라이트 자동 감지를
    // 끈다(감지 오검출로 Plain 코드에 색이 입던 문제 방지). ``` 뒤 언어는 우선 적용.
    CodeBlockLowlight.extend({
      addNodeView() {
        return ReactNodeViewRenderer(CodeBlockView);
      },
      addProseMirrorPlugins() {
        // this.parent?.() = lowlight 구문강조 플러그인 보존 + 자동 닫기 추가.
        return [...(this.parent?.() ?? []), codeBlockAutoPairs(this.name)];
      },
      addKeyboardShortcuts() {
        // 베이스 단축키(Tab 들여쓰기·Backspace·triple-Enter 종료 등) 보존 후
        // Enter 만 확장: 베이스 Enter(triple-enter 종료) 먼저 시도 → { , [ 뒤
        // 자동 들여쓰기. 둘 다 아니면 false 로 기본 줄바꿈에 넘긴다.
        const parent = this.parent?.() ?? {};
        return {
          ...parent,
          Enter: () => {
            if (parent.Enter?.({ editor: this.editor })) return true;
            return codeBlockEnterIndent(this.editor, this.name);
          },
        };
      },
    }).configure({ lowlight, defaultLanguage: "plaintext" }),
    // 표(header row 있는 리사이즈 가능 테이블).
    TableKit.configure({ table: { resizable: true } }),
    // 표 경계 키맵(ArrowLeft 로 표 선택 → 삭제).
    TableControls,
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
