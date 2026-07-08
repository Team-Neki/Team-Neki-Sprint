import {
  getWikiTree,
  getWikiFolders,
  getWikiFavorites,
  getTrashedWikiPages,
} from "@/server/queries";
import { requireUser } from "@/lib/session";
import { PageTree } from "@/components/wiki/page-tree";
import { FavoritesPanel } from "@/components/wiki/favorites-panel";
import { TrashLink } from "@/components/wiki/trash-link";

export const dynamic = "force-dynamic";

export default async function WikiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [pages, folders, favorites, trashed] = await Promise.all([
    getWikiTree(),
    getWikiFolders(),
    getWikiFavorites(user.id),
    getTrashedWikiPages(),
  ]);

  const favoriteIds = favorites.map((f) => f.page.id);
  const favoriteItems = favorites.map((f) => ({
    id: f.page.id,
    title: f.page.title,
  }));

  return (
    <div className="flex gap-6">
      <aside className="hidden w-64 shrink-0 md:block">
        <div className="sticky top-0 space-y-4">
          {/* 즐겨찾기 → 콘텐츠 → 휴지통 (좌측 사이드바 단일 컬럼) */}
          <FavoritesPanel favorites={favoriteItems} />
          <PageTree pages={pages} folders={folders} favoriteIds={favoriteIds} />
          <TrashLink count={trashed.length} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
