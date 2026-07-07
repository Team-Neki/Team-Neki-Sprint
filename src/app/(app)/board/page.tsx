import { Plus } from "lucide-react";
import {
  getBoardTasks,
  getEpicOptions,
  getTeamOptions,
  getMembers,
} from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/board/kanban";
import { OwnerFilter } from "@/components/filters/owner-filter";
import { TeamFilter } from "@/components/filters/team-filter";
import { TaskDialog } from "@/components/forms/task-dialog";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ assignee?: string; team?: string }>;
}) {
  const sp = await searchParams;
  const [tasks, epics, teams, members] = await Promise.all([
    getBoardTasks({
      assigneeId: sp.assignee || undefined,
      teamId: sp.team || undefined,
    }),
    getEpicOptions(),
    getTeamOptions(),
    getMembers(),
  ]);

  const epicOptions = epics.map((e) => ({
    id: e.id,
    title: e.title,
    teamId: e.team.id,
  }));

  return (
    <div>
      <PageHeader
        title="보드"
        description="상태별로 태스크를 관리하세요. 카드를 끌어 상태를 바꿀 수 있어요."
      >
        <TaskDialog
          members={members}
          teams={teams}
          epics={epicOptions}
          trigger={
            <Button>
              <Plus className="size-4" /> 새 태스크
            </Button>
          }
        />
      </PageHeader>

      <OwnerFilter
        members={members}
        paramKey="assignee"
        placeholder="담당자"
        allLabel="모든 담당자"
      >
        <TeamFilter teams={teams} />
      </OwnerFilter>

      <KanbanBoard tasks={tasks} />
    </div>
  );
}
