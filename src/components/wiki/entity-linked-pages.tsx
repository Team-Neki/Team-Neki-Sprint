"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FileText, X } from "lucide-react";
import { toast } from "sonner";
import { searchWikiPagesAction } from "@/server/actions/wiki";
import {
  linkPageToEntity,
  unlinkPageFromEntity,
  type LinkEntityType,
} from "@/server/actions/entity-wiki-links";
import { LinkSearchPopover, type LinkItem } from "@/components/wiki/link-search";

export type LinkedPage = {
  id: string;
  title: string;
};

/**
 * sprint/project/epic 상세의 "연결된 위키" 카드. 태스크 상세의 LinkedPages 와 동형이나
 * (검색·연결·해제 UX 동일), 대상 엔티티가 태스크가 아니라 제네릭 링크 액션을 쓴다.
 * 태스크는 기존 LinkedPages 를 그대로 유지한다(그쪽 파일은 건드리지 않음).
 */
export function EntityLinkedPages({
  entityType,
  entityId,
  pages,
}: {
  entityType: LinkEntityType;
  entityId: string;
  pages: LinkedPage[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  async function search(query: string): Promise<LinkItem[]> {
    const rows = await searchWikiPagesAction(query);
    return rows.map((p) => ({
      id: p.id,
      label: p.title || "제목 없음",
      node: (
        <span className="flex min-w-0 items-center gap-2">
          <FileText className="text-muted-foreground size-3.5 shrink-0" />
          <span className="truncate">{p.title || "제목 없음"}</span>
        </span>
      ),
    }));
  }

  async function add(pageId: string) {
    await linkPageToEntity(entityType, entityId, pageId);
    router.refresh();
  }

  function remove(pageId: string) {
    start(async () => {
      try {
        await unlinkPageFromEntity(entityType, entityId, pageId);
        router.refresh();
      } catch {
        toast.error("연결 해제에 실패했습니다");
      }
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-muted-foreground text-xs">연결된 위키</span>
        <LinkSearchPopover
          triggerLabel="위키 연결"
          placeholder="위키 페이지 검색…"
          emptyLabel="페이지가 없습니다"
          search={search}
          onSelect={add}
          excludeIds={pages.map((p) => p.id)}
        />
      </div>
      {pages.length === 0 ? (
        <p className="text-muted-foreground text-sm">연결된 위키가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {pages.map((p) => (
            <li key={p.id} className="group flex items-center gap-2 text-sm">
              <Link
                href={`/wiki/${p.id}`}
                className="flex min-w-0 flex-1 items-center gap-1.5 hover:underline"
              >
                <FileText className="text-muted-foreground size-3.5 shrink-0" />
                <span className="truncate">{p.title || "제목 없음"}</span>
              </Link>
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={pending}
                className="text-muted-foreground hover:text-destructive shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                title="연결 해제"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
