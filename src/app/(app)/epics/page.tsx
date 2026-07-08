import { Plus, Layers } from "lucide-react";
import {
  getEpics,
  getProjectOptions,
  getTeamOptions,
  getMembers,
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
  const [epics, projects, teams, members] = await Promise.all([
    getEpics({ ownerId: sp.owner || undefined, teamId: sp.team || undefined }),
    getProjectOptions(),
    getTeamOptions(),
    getMembers(),
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

      {epics.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Layers className="text-muted-foreground size-6" />
          </div>
          <p className="text-muted-foreground text-sm">아직 에픽이 없습니다.</p>
          <EpicDialog
            members={members}
            teams={teams}
            projects={projects}
            trigger={
              <Button variant="outline">
                <Plus className="size-4" /> 첫 에픽 만들기
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <EpicsTable epics={epics} edit={{ members, teams, projects }} />
        </Card>
      )}
    </div>
  );
}
