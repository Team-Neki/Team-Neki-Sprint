import { Mark, mergeAttributes } from "@tiptap/core";

// B10 위키 인라인 댓글의 앵커. 선택한 텍스트 범위에 씌우는 하이라이트 마크로,
// threadId 로 WikiCommentThread 와 연결된다. 앵커 자체는 위키 문서 content(JSON)에
// 저장되므로 편집/뷰 확장(wikiExtensions)이 공유해야 어긋나지 않는다.
//
// 렌더는 <span data-comment-thread=<id> class="wiki-comment-mark"> — 클릭 시
// 뷰 컴포넌트가 data-comment-thread 를 읽어 해당 스레드를 활성화한다(스타일은 globals.css).

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    commentMark: {
      /** 현재 선택 범위에 지정 threadId 의 댓글 마크를 씌운다. */
      setCommentThread: (threadId: string) => ReturnType;
      /** 문서 전체에서 특정 threadId 의 댓글 마크를 제거(해결/삭제 시). */
      unsetCommentThread: (threadId: string) => ReturnType;
    };
  }
}

export const CommentMark = Mark.create({
  name: "commentMark",
  // 여러 스레드가 겹칠 수 있으므로 inclusive=false 로 경계에서 자동 확장하지 않는다.
  inclusive: false,
  // 링크 등 다른 마크와 공존 가능.
  excludes: "",

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment-thread"),
        renderHTML: (attrs) =>
          attrs.threadId
            ? { "data-comment-thread": attrs.threadId as string }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-thread]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "wiki-comment-mark" }),
      0,
    ];
  },

  addCommands() {
    return {
      setCommentThread:
        (threadId: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { threadId }),

      // 특정 스레드의 마크만 걷어낸다. ProseMirror 문서를 순회하며 해당 threadId 를
      // 가진 commentMark 구간을 찾아 removeMark 한다(다른 스레드 마크는 보존).
      unsetCommentThread:
        (threadId: string) =>
        ({ tr, state, dispatch }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) return false;
          let changed = false;
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            const mark = node.marks.find(
              (m) => m.type === markType && m.attrs.threadId === threadId,
            );
            if (mark) {
              tr.removeMark(pos, pos + node.nodeSize, mark);
              changed = true;
            }
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        },
    };
  },
});
