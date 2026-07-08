import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
// '#' 티켓 멘션(#4) / '@' 사람 멘션(B5). 각각 자기완결 모듈, 여기 한 줄씩만 추가.
import { TicketMention } from "@/components/wiki/ticket-mention";
import { PersonMention } from "@/components/wiki/person-mention";
// 인라인 댓글 앵커(B10). 편집/뷰가 동일 스키마로 파싱해야 하므로 여기서 공유한다.
import { CommentMark } from "@/components/wiki/comment-mark";

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
    // StarterKit v3 는 Link 를 기본 포함하므로 끈다(link: false) — 아래에서
    // openOnClick/autolink 를 지정한 Link 를 따로 등록(중복 확장 경고 방지).
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
    ...(opts?.placeholder
      ? [Placeholder.configure({ placeholder: opts.placeholder })]
      : []),
    Link.configure({ openOnClick: false, autolink: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TicketMention,
    PersonMention,
    CommentMark,
  ];
}
