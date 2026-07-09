import { Plus, ListTodo } from "lucide-react";
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
import { EmptyState } from "@/components/empty-state";

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
  const [tasks, epics, teams, members, labels] = await Promise.all([
    getTasks({
      status: (sp.status as Status) || undefined,
      assigneeId: sp.assignee || undefined,
      teamId: sp.team || undefined,
      labelId: sp.label || undefined,
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

      {tasks.length === 0 ? (
        hasFilter ? (
          <EmptyState
            icon={ListTodo}
            title="조건에 맞는 태스크가 없습니다"
            description="필터를 조정하거나 초기화해 보세요."
          />
        ) : (
          <EmptyState
            icon={ListTodo}
            title="아직 태스크가 없습니다"
            description="첫 태스크를 만들어 작업을 시작하세요."
            action={
              <TaskDialog
                members={members}
                teams={teams}
                epics={epicOptions}
                trigger={
                  <Button variant="outline">
                    <Plus className="size-4" /> 첫 태스크 만들기
                  </Button>
                }
              />
            }
          />
        )
      ) : (
        <Card className="overflow-hidden py-0">
          <TasksTable tasks={tasks} edit={{ members, teams, epics: epicOptions }} />
        </Card>
      )}
    </div>
  );
}
