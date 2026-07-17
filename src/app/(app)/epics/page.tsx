import { Plus } from "lucide-react";
import {
  getEpics,
  getProjectOptions,
  getTeamOptions,
  getMembers,
  getLabelOptions,
} from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EpicsTable } from "@/components/tables/epics-table";
import { OwnerFilter } from "@/components/filters/owner-filter";
import { TeamFilter } from "@/components/filters/team-filter";
import { EpicDialog } from "@/components/forms/epic-dialog";

export const dynamic = "force-dynamic";

export default async function EpicsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; team?: string }>;
}) {
  const sp = await searchParams;
  const [epics, projects, teams, members, labels] = await Promise.all([
    getEpics({ ownerId: sp.owner || undefined, teamId: sp.team || undefined }),
    getProjectOptions(),
    getTeamOptions(),
    getMembers(),
    getLabelOptions(),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="에픽"
        description="팀이 소유하는 작업 단위입니다. 표시 key는 팀 접두어를 따릅니다."
      >
        <EpicDialog
          members={members}
          teams={teams}
          projects={projects}
          trigger={
            <Button>
              <Plus className="size-4" /> 새 에픽
            </Button>
          }
        />
      </PageHeader>

      <OwnerFilter members={members}>
        <TeamFilter teams={teams} />
      </OwnerFilter>

      {/* 항목이 없어도 컬럼 헤더가 보이도록 항상 표를 렌더한다(빈 안내는 표 안 EmptyRow). */}
      <Card className="overflow-hidden py-0">
        <EpicsTable
          epics={epics}
          emptyMessage="아직 에픽이 없습니다. 상단 ‘새 에픽’으로 만들어보세요."
          edit={{ members, teams, projects, labels }}
        />
      </Card>
    </div>
  );
}
