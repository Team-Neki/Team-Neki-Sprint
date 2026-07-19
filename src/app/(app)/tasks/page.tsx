import { Plus } from "lucide-react";
import type { Status } from "@prisma/client";
import {
  getTasks,
  getEpicOptions,
  getTeamOptions,
  getMembers,
  getLabelOptions,
} from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TasksTable } from "@/components/tables/tasks-table";
import { TaskDialog } from "@/components/forms/task-dialog";
import { TaskFilters } from "@/components/tasks/task-filters";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    assignee?: string;
    team?: string;
    label?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  // 필터가 하나라도 걸렸으면 "필터 결과 0"으로 안내(생성 CTA 대신 필터 조정 유도).
  const hasFilter = !!(
    sp.status ||
    sp.assignee ||
    sp.team ||
    sp.label ||
    sp.q
  );
  // 다중선택 필터는 콤마구분 값(예: `?assignee=a,b`) → 배열로 파싱한다(F6).
  const toArray = (v?: string) => (v ?? "").split(",").filter(Boolean);
  const [tasks, epics, teams, members, labels] = await Promise.all([
    getTasks({
      status: toArray(sp.status) as Status[],
      assigneeId: toArray(sp.assignee),
      teamId: toArray(sp.team),
      labelId: toArray(sp.label),
      q: sp.q || undefined,
    }),
    getEpicOptions(),
    getTeamOptions(),
    getMembers(),
    getLabelOptions(),
  ]);

  const epicOptions = epics.map((e) => ({
    id: e.id,
    title: e.title,
    teamId: e.team.id,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="태스크" description="모든 태스크를 표로 관리하세요.">
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

      <TaskFilters members={members} teams={teams} labels={labels} />

      {/* 항목이 없어도 컬럼 헤더가 보이도록 항상 표를 렌더한다(빈 안내는 표 안 EmptyRow). */}
      <Card className="overflow-hidden py-0">
        <TasksTable
          tasks={tasks}
          emptyMessage={
            hasFilter
              ? "조건에 맞는 태스크가 없습니다. 필터를 조정하거나 초기화해 보세요."
              : "아직 태스크가 없습니다. 상단 ‘새 태스크’로 만들어보세요."
          }
          edit={{ members, teams, epics: epicOptions, labels }}
        />
      </Card>
    </div>
  );
}
