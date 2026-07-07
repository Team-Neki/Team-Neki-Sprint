import { getWikiTree, getWikiFolders, getWikiFavorites } from "@/server/queries";
import { requireUser } from "@/lib/session";
import { PageTree } from "@/components/wiki/page-tree";
import { FavoritesPanel } from "@/components/wiki/favorites-panel";

export const dynamic = "force-dynamic";

export default async function WikiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [pages, folders, favorites] = await Promise.all([
    getWikiTree(),
    getWikiFolders(),
    getWikiFavorites(user.id),
  ]);

  const favoriteIds = favorites.map((f) => f.page.id);
  const favoriteItems = favorites.map((f) => ({
    id: f.page.id,
    title: f.page.title,
  }));

  return (
    <div className="flex gap-6">
      <aside className="hidden w-64 shrink-0 md:block">
        <div className="sticky top-20">
          <PageTree pages={pages} folders={folders} favoriteIds={favoriteIds} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
      <aside className="hidden w-56 shrink-0 xl:block">
        <FavoritesPanel favorites={favoriteItems} />
      </aside>
    </div>
  );
}
