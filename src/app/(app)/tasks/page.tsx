import { Plus } from "lucide-react";
import type { Status } from "@prisma/client";
import {
  getTasks,
  getEpicOptions,
  getTeamOptions,
  getMembers,
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
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const [tasks, epics, teams, members] = await Promise.all([
    getTasks({
      status: (sp.status as Status) || undefined,
      assigneeId: sp.assignee || undefined,
      teamId: sp.team || undefined,
      q: sp.q || undefined,
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

      <TaskFilters members={members} teams={teams} />

      <Card className="overflow-hidden py-0">
        <TasksTable tasks={tasks} />
      </Card>
    </div>
  );
}
