import { Plus } from "lucide-react";
import { getBoardTasks, getEpics, getMembers } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/board/kanban";
import { OwnerFilter } from "@/components/filters/owner-filter";
import { TaskDialog } from "@/components/forms/task-dialog";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ assignee?: string }>;
}) {
  const sp = await searchParams;
  const [tasks, epics, members] = await Promise.all([
    getBoardTasks({ assigneeId: sp.assignee || undefined }),
    getEpics(),
    getMembers(),
  ]);

  return (
    <div>
      <PageHeader
        title="보드"
        description="상태별로 태스크를 관리하세요. 카드를 끌어 상태를 바꿀 수 있어요."
      >
        <TaskDialog
          members={members}
          epics={epics.map((e) => ({ id: e.id, title: e.title }))}
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
      />

      <KanbanBoard tasks={tasks} />
    </div>
  );
}
