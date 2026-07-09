import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import type { JSONContent } from "@tiptap/react";
import {
  getWikiPage,
  getWikiTree,
  getWikiRevisions,
  isWikiPageFavorited,
  getWikiComments,
  getWikiDraft,
} from "@/server/queries";
import { requireUser } from "@/lib/session";
import { WikiDetail } from "@/components/wiki/wiki-detail";
import { LinkedTickets } from "@/components/wiki/linked-tickets";

export const dynamic = "force-dynamic";

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function asDoc(content: unknown): JSONContent {
  if (
    content &&
    typeof content === "object" &&
    "type" in content &&
    (content as { type?: string }).type === "doc"
  ) {
    return content as JSONContent;
  }
  return EMPTY_DOC;
}

/**
 * parent 관계가 onDelete: Cascade 이므로 페이지를 지우면 모든 하위(재귀) 페이지도
 * 함께 삭제된다. 삭제 경고에 노출할 후손 페이지 총 개수를 센다.
 */
function countDescendants(
  nodes: { id: string; parentId: string | null }[],
  rootId: string,
): number {
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const list = childrenOf.get(n.parentId);
    if (list) list.push(n.id);
    else childrenOf.set(n.parentId, [n.id]);
  }

  let count = 0;
  const stack = [...(childrenOf.get(rootId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    count += 1;
    const kids = childrenOf.get(id);
    if (kids) stack.push(...kids);
  }
  return count;
}

export default async function WikiPageView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [page, tree, revisions, favorited, threads, draftRow] =
    await Promise.all([
      getWikiPage(id),
      getWikiTree(),
      getWikiRevisions(id),
      isWikiPageFavorited(user.id, id),
      getWikiComments(id),
      getWikiDraft(id, user.id),
    ]);
  if (!page) notFound();

  const linkedTickets = page.taskLinks.map((l) => ({
    id: l.task.id,
    number: l.task.number,
    title: l.task.title,
    status: l.task.status,
    teamKey: l.task.team?.key ?? null,
  }));

  const descendantCount = countDescendants(tree, id);
  const deleteDescription =
    descendantCount > 0
      ? `하위 ${descendantCount}개 페이지도 함께 휴지통으로 이동합니다. 휴지통에서 복원할 수 있습니다.`
      : "휴지통으로 이동합니다. 휴지통에서 복원할 수 있습니다.";

  const updatedLabel = `${formatDistanceToNow(page.updatedAt, {
    addSuffix: true,
    locale: ko,
  })} 수정`;

  return (
    // pb-16: 긴 페이지에서 스크롤 끝에 하단 여백 확보. main(overflow-y-auto)의 pb 는
    // 스크롤 컨테이너 자기 하단 패딩이라 overflow 끝에서 무시될 수 있어(WebKit), 여백을
    // 스크롤 높이에 포함되는 자식 블록에 준다. (연결된 티켓이 바닥에 딱 붙던 문제)
    <div className="pb-16">
      <WikiDetail
        pageId={page.id}
        title={page.title}
        content={asDoc(page.content)}
        editor={page.editor}
        updatedLabel={updatedLabel}
        updatedAt={page.updatedAt.toISOString()}
        favorited={favorited}
        revisions={revisions}
        deleteDescription={deleteDescription}
        threads={threads}
        currentUserId={user.id}
        draft={
          draftRow
            ? { title: draftRow.title, content: asDoc(draftRow.content) }
            : null
        }
      />

      <LinkedTickets pageId={page.id} tickets={linkedTickets} />
    </div>
  );
}
