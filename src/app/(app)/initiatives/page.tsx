import { Plus, Target } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { getInitiatives, getMembers } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ItemRow, RowMeta } from "@/components/item-row";
import { OwnerFilter } from "@/components/filters/owner-filter";
import { InitiativeDialog } from "@/components/forms/initiative-dialog";

export const dynamic = "force-dynamic";

export default async function InitiativesPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  const sp = await searchParams;
  const [initiatives, members] = await Promise.all([
    getInitiatives({ ownerId: sp.owner || undefined }),
    getMembers(),
  ]);

  return (
    <div>
      <PageHeader
        title="이니셔티브"
        description="가장 큰 단위의 목표입니다. 하위에 에픽과 태스크가 연결됩니다."
      >
        <InitiativeDialog
          members={members}
          trigger={
            <Button>
              <Plus className="size-4" /> 새 이니셔티브
            </Button>
          }
        />
      </PageHeader>

      <OwnerFilter members={members} />

      {initiatives.length === 0 ? (
        <EmptyState members={members} />
      ) : (
        <div className="flex flex-col gap-2">
          {initiatives.map((i) => (
            <ItemRow
              key={i.id}
              href={`/initiatives/${i.id}`}
              itemKey={`INI-${i.key}`}
              title={i.title}
              priority={i.priority}
              status={i.status}
              owner={i.owner}
              meta={
                <>
                  <RowMeta className="w-20 sm:block">
                    에픽 {i._count.epics}
                  </RowMeta>
                  {i.dueDate && (
                    <RowMeta className="w-24 md:block">
                      ~{format(i.dueDate, "yy.M.d", { locale: ko })}
                    </RowMeta>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  members,
}: {
  members: Awaited<ReturnType<typeof getMembers>>;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 py-16">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <Target className="text-muted-foreground size-6" />
      </div>
      <p className="text-muted-foreground text-sm">아직 이니셔티브가 없습니다.</p>
      <InitiativeDialog
        members={members}
        trigger={
          <Button variant="outline">
            <Plus className="size-4" /> 첫 이니셔티브 만들기
          </Button>
        }
      />
    </Card>
  );
}
