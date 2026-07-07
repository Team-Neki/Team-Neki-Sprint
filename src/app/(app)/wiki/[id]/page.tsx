import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import type { JSONContent } from "@tiptap/react";
import {
  getWikiPage,
  getWikiTree,
  getWikiFolders,
  getWikiRevisions,
  isWikiPageFavorited,
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
  const [page, tree, folders, revisions, favorited] = await Promise.all([
    getWikiPage(id),
    getWikiTree(),
    getWikiFolders(),
    getWikiRevisions(id),
    isWikiPageFavorited(user.id, id),
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
      ? `하위 ${descendantCount}개 페이지도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`
      : "이 작업은 되돌릴 수 없습니다.";

  const updatedLabel = `${formatDistanceToNow(page.updatedAt, {
    addSuffix: true,
    locale: ko,
  })} 수정`;

  return (
    <div>
      <WikiDetail
        pageId={page.id}
        title={page.title}
        content={asDoc(page.content)}
        editor={page.editor}
        updatedLabel={updatedLabel}
        folderId={page.folderId}
        folders={folders}
        favorited={favorited}
        revisions={revisions}
        deleteDescription={deleteDescription}
      />

      <LinkedTickets pageId={page.id} tickets={linkedTickets} />
    </div>
  );
}
