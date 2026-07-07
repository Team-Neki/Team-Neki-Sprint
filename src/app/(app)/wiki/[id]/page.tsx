import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import type { JSONContent } from "@tiptap/react";
import { getWikiPage, getWikiTree } from "@/server/queries";
import { deleteWikiPage } from "@/server/actions/wiki";
import { WikiEditor } from "@/components/wiki/editor";
import { UserBadge } from "@/components/user-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";

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
  const [page, tree] = await Promise.all([getWikiPage(id), getWikiTree()]);
  if (!page) notFound();

  const descendantCount = countDescendants(tree, id);
  const deleteDescription =
    descendantCount > 0
      ? `하위 ${descendantCount}개 페이지도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`
      : "이 작업은 되돌릴 수 없습니다.";

  async function handleDelete() {
    "use server";
    await deleteWikiPage(id);
  }

  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {page.editor && <UserBadge user={page.editor} size="xs" />}
          <span>
            {formatDistanceToNow(page.updatedAt, {
              addSuffix: true,
              locale: ko,
            })}{" "}
            수정
          </span>
        </div>
        <ConfirmDelete
          onConfirm={handleDelete}
          redirectTo="/wiki"
          title="이 페이지를 삭제할까요?"
          description={deleteDescription}
          trigger={
            <Button variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="size-4" /> 삭제
            </Button>
          }
        />
      </div>

      <WikiEditor
        key={page.id}
        pageId={page.id}
        initialTitle={page.title}
        initialContent={asDoc(page.content)}
      />
    </div>
  );
}
