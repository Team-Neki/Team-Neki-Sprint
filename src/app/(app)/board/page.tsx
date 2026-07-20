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
  // 다중선택 필터는 콤마구분 값(예: `?team=a,b`) → 배열로 파싱한다(F6).
  const toArray = (v?: string) => (v ?? "").split(",").filter(Boolean);
  const teamIds = toArray(sp.team);
  const [tasks, epics, teams, members] = await Promise.all([
    getBoardTasks({
      assigneeId: toArray(sp.assignee),
      teamId: teamIds,
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

      <KanbanBoard
        tasks={tasks}
        createCtx={{
          members,
          teams,
          epics: epicOptions,
          // 정확히 한 팀만 필터돼 있을 때만 새 태스크의 기본 팀으로 사용.
          defaultTeamId: teamIds.length === 1 ? teamIds[0] : undefined,
        }}
      />
    </div>
  );
}
