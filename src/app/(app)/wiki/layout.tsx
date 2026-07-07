import { getWikiTree } from "@/server/queries";
import { PageTree } from "@/components/wiki/page-tree";
import { NewPageButton } from "@/components/wiki/new-page-button";

export const dynamic = "force-dynamic";

export default async function WikiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nodes = await getWikiTree();

  return (
    <div className="flex gap-6">
      <aside className="hidden w-64 shrink-0 md:block">
        <div className="sticky top-20">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">위키</h2>
            <NewPageButton />
          </div>
          <PageTree nodes={nodes} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
