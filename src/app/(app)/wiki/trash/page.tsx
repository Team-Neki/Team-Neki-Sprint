import { Trash2 } from "lucide-react";
import { getTrashedWikiPages } from "@/server/queries";
import { requireUser } from "@/lib/session";
import { TrashList, type TrashItem } from "@/components/wiki/trash-list";

export const dynamic = "force-dynamic";

export default async function WikiTrashPage() {
  const user = await requireUser();
  const trashed = await getTrashedWikiPages(user.id);

  // '삭제 루트'만 노출: 부모가 없거나, 부모는 휴지통에 없는(개별 삭제된) 페이지.
  const trashedIds = new Set(trashed.map((p) => p.id));
  const childrenOf = new Map<string, string[]>();
  for (const p of trashed) {
    if (p.parentId && trashedIds.has(p.parentId)) {
      const list = childrenOf.get(p.parentId);
      if (list) list.push(p.id);
      else childrenOf.set(p.parentId, [p.id]);
    }
  }

  function countDescendants(rootId: string): number {
    let count = 0;
    const stack = [...(childrenOf.get(rootId) ?? [])];
    while (stack.length) {
      const id = stack.pop() as string;
      count += 1;
      const kids = childrenOf.get(id);
      if (kids) stack.push(...kids);
    }
    return count;
  }

  const items: TrashItem[] = trashed
    .filter((p) => !p.parentId || !trashedIds.has(p.parentId))
    .map((p) => ({
      id: p.id,
      title: p.title,
      deletedAt: p.deletedAt as Date,
      editor: p.editor,
      descendantCount: countDescendants(p.id),
    }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-2">
        <Trash2 className="text-muted-foreground size-5" />
        <h1 className="text-xl font-semibold">휴지통</h1>
        {items.length > 0 && (
          <span className="text-muted-foreground text-sm">
            {items.length}개
          </span>
        )}
      </div>
      <p className="text-muted-foreground mb-4 text-sm">
        삭제한 문서는 여기에 보관됩니다. 복원하거나 영구 삭제할 수 있습니다.
      </p>
      <TrashList items={items} />
    </div>
  );
}
