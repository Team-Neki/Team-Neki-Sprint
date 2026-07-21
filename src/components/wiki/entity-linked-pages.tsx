"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FileText, X } from "lucide-react";
import { toast } from "sonner";
import {
  linkTaskToPage,
  unlinkTaskFromPage,
  searchWikiPagesAction,
} from "@/server/actions/wiki";
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
 * task/sprint/project/epic 상세의 "연결된 위키" 카드(4종 공용 — 2026-07-22 통합,
 * 종전 태스크 전용 `LinkedPages` 를 흡수). 검색·연결·해제 UX 는 한 벌이고,
 * 태스크만 조인 테이블이 달라 전용 링크 액션(`linkTaskToPage`)으로 분기한다.
 */
export function EntityLinkedPages({
  entityType,
  entityId,
  pages,
}: {
  entityType: LinkEntityType | "task";
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
    if (entityType === "task") await linkTaskToPage(pageId, entityId);
    else await linkPageToEntity(entityType, entityId, pageId);
    router.refresh();
  }

  function remove(pageId: string) {
    start(async () => {
      try {
        if (entityType === "task") await unlinkTaskFromPage(pageId, entityId);
        else await unlinkPageFromEntity(entityType, entityId, pageId);
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
