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
import { WikiNavSheet } from "@/components/wiki/wiki-nav-sheet";
import { WikiSidebar } from "@/components/wiki/wiki-sidebar";

export const dynamic = "force-dynamic";

export default async function WikiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [pages, folders, favorites, trashed] = await Promise.all([
    getWikiTree(user.id),
    getWikiFolders(),
    getWikiFavorites(user.id),
    getTrashedWikiPages(user.id),
  ]);

  const favoriteIds = favorites.map((f) => f.page.id);
  const favoriteItems = favorites.map((f) => ({
    id: f.page.id,
    title: f.page.title,
  }));

  // 즐겨찾기 → 콘텐츠 → 휴지통 (데스크톱 사이드바 + 모바일 드로어가 공유).
  const nav = (
    <>
      <FavoritesPanel favorites={favoriteItems} />
      <PageTree pages={pages} folders={folders} favoriteIds={favoriteIds} />
      <TrashLink count={trashed.length} />
    </>
  );

  return (
    <div className="flex gap-6">
      <WikiSidebar>{nav}</WikiSidebar>
      <div className="min-w-0 flex-1">
        {/* 모바일: 좌측 사이드바가 숨겨지므로 드로어로 문서 트리 접근 제공 */}
        <WikiNavSheet>{nav}</WikiNavSheet>
        {children}
      </div>
    </div>
  );
}
