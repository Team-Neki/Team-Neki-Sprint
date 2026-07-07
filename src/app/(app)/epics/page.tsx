import { Plus, Layers } from "lucide-react";
import { getEpics, getInitiatives, getMembers } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ItemRow, RowMeta } from "@/components/item-row";
import { OwnerFilter } from "@/components/filters/owner-filter";
import { EpicDialog } from "@/components/forms/epic-dialog";

export const dynamic = "force-dynamic";

export default async function EpicsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  const sp = await searchParams;
  const [epics, initiatives, members] = await Promise.all([
    getEpics({ ownerId: sp.owner || undefined }),
    getInitiatives(),
    getMembers(),
  ]);
  const initiativeOptions = initiatives.map((i) => ({ id: i.id, title: i.title }));

  return (
    <div>
      <PageHeader
        title="에픽"
        description="이니셔티브를 이루는 중간 단위입니다. 하위에 태스크가 연결됩니다."
      >
        <EpicDialog
          members={members}
          initiatives={initiativeOptions}
          trigger={
            <Button>
              <Plus className="size-4" /> 새 에픽
            </Button>
          }
        />
      </PageHeader>

      <OwnerFilter members={members} />

      {epics.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Layers className="text-muted-foreground size-6" />
          </div>
          <p className="text-muted-foreground text-sm">아직 에픽이 없습니다.</p>
          <EpicDialog
            members={members}
            initiatives={initiativeOptions}
            trigger={
              <Button variant="outline">
                <Plus className="size-4" /> 첫 에픽 만들기
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {epics.map((e) => (
            <ItemRow
              key={e.id}
              href={`/epics/${e.id}`}
              itemKey={`EPIC-${e.key}`}
              title={e.title}
              priority={e.priority}
              status={e.status}
              owner={e.owner}
              meta={
                <>
                  {e.initiative && (
                    <RowMeta className="max-w-40 truncate md:block">
                      {e.initiative.title}
                    </RowMeta>
                  )}
                  <RowMeta className="w-16 sm:block">
                    태스크 {e._count.tasks}
                  </RowMeta>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
