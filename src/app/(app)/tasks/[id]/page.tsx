import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import {
  getTask,
  getEpicOptions,
  getMembers,
  getEntityActivity,
  getLabelOptions,
} from "@/server/queries";
import { deleteTask } from "@/server/actions/tasks";
import { formatIssueKey } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserBadge } from "@/components/user-badge";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CommentForm } from "@/components/tasks/comment-form";
import { RichContent } from "@/components/rich-text/rich-editor";
import { LinkedPages } from "@/components/wiki/linked-pages";
import { BackButton } from "@/components/detail/back-button";
import { HistoryPanel } from "@/components/detail/history-panel";
import { EpicField } from "@/components/detail/epic-field";
import { TaskLabels } from "@/components/detail/task-labels";
import { TaskDependencies } from "@/components/detail/task-dependencies";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  MetaRow,
  InlineTitle,
  InlineDescription,
  InlineStatus,
  InlinePriority,
  InlineMember,
  InlineDate,
  InlineNumber,
} from "@/components/detail/inline-fields";

export const dynamic = "force-dynamic";

export default async function TaskDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [task, epics, members, activities, labelOptions] = await Promise.all([
    getTask(id),
    getEpicOptions(),
    getMembers(),
    getEntityActivity("task", id),
    getLabelOptions(),
  ]);
  if (!task) notFound();

  const epicPickOptions = epics.map((e) => ({
    id: e.id,
    title: e.title,
    number: e.number,
    teamKey: e.team?.key ?? null,
  }));

  async function handleDelete() {
    "use server";
    await deleteTask(id);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <BackButton fallback="/board" label="보드" />

        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-muted-foreground font-mono text-xs">
              {formatIssueKey(task.team?.key, task.number)}
            </span>
            <InlineTitle type="task" id={task.id} value={task.title} />
          </div>
          <ConfirmDelete
            onConfirm={handleDelete}
            redirectTo="/board"
            trigger={
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="size-4" />
              </Button>
            }
          />
        </div>

        <Card className="mb-6 p-5">
          <h3 className="mb-2 text-sm font-medium">설명</h3>
          <InlineDescription
            type="task"
            id={task.id}
            value={task.description}
          />
        </Card>

        <Tabs defaultValue="comments">
          <TabsList variant="line">
            <TabsTrigger value="comments">
              댓글 {task.comments.length}
            </TabsTrigger>
            <TabsTrigger value="history">업무 히스토리</TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="mt-4">
            <div className="mb-4 flex flex-col gap-4">
              {task.comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <UserBadge user={c.author} hideName />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {c.author.name ?? c.author.email}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatDistanceToNow(c.createdAt, {
                          addSuffix: true,
                          locale: ko,
                        })}
                      </span>
                    </div>
                    <RichContent value={c.body} className="mt-0.5" />
                  </div>
                </div>
              ))}
              {task.comments.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  아직 댓글이 없습니다.
                </p>
              )}
            </div>
            <CommentForm taskId={task.id} />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <HistoryPanel
              activities={activities}
              members={members}
              epics={epics.map((e) => ({ id: e.id, title: e.title }))}
              title=""
            />
          </TabsContent>
        </Tabs>
      </div>

      <div className="lg:col-span-1 flex flex-col gap-4">
        <Card className="flex flex-col gap-3 p-5">
          <MetaRow label="상태">
            <InlineStatus type="task" id={task.id} value={task.status} />
          </MetaRow>
          <MetaRow label="담당자">
            <InlineMember
              type="task"
              id={task.id}
              field="assigneeId"
              value={task.assignee}
              members={members}
            />
          </MetaRow>
          <MetaRow label="보고자">
            <InlineMember
              type="task"
              id={task.id}
              field="reporterId"
              value={task.reporter}
              members={members}
            />
          </MetaRow>
          <MetaRow label="우선순위">
            <InlinePriority type="task" id={task.id} value={task.priority} />
          </MetaRow>
          <MetaRow label="에픽">
            <EpicField
              taskId={task.id}
              epicId={task.epicId}
              epics={epicPickOptions}
            />
          </MetaRow>
          <MetaRow label="스토리 포인트">
            <InlineNumber
              type="task"
              id={task.id}
              field="storyPoints"
              value={task.storyPoints}
            />
          </MetaRow>
          <MetaRow label="예상 MD">
            <InlineNumber
              type="task"
              id={task.id}
              field="estimatedMd"
              value={task.estimatedMd}
              step="0.5"
            />
          </MetaRow>
          <MetaRow label="실제 MD">
            <InlineNumber
              type="task"
              id={task.id}
              field="actualMd"
              value={task.actualMd}
              step="0.5"
            />
          </MetaRow>
          <MetaRow label="시작일">
            <InlineDate
              type="task"
              id={task.id}
              field="startDate"
              value={task.startDate}
            />
          </MetaRow>
          <MetaRow label="기한">
            <InlineDate
              type="task"
              id={task.id}
              field="dueDate"
              value={task.dueDate}
            />
          </MetaRow>
          <MetaRow label="팀">
            <span className="inline-flex items-center gap-1.5 pr-1.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={
                  task.team?.color
                    ? { backgroundColor: task.team.color }
                    : undefined
                }
              />
              <span className="text-muted-foreground font-mono text-xs">
                {task.team?.key}
              </span>
            </span>
          </MetaRow>
          <MetaRow label="라벨" align="start">
            <TaskLabels
              taskId={task.id}
              labels={task.labels.map((l) => l.label)}
              allLabels={labelOptions}
            />
          </MetaRow>
        </Card>

        <Card className="p-5">
          <TaskDependencies
            taskId={task.id}
            blockers={task.blockedBy.map((d) => ({
              id: d.blocker.id,
              number: d.blocker.number,
              title: d.blocker.title,
              status: d.blocker.status,
              teamKey: d.blocker.team?.key ?? null,
            }))}
            blocking={task.blocking.map((d) => ({
              id: d.blocked.id,
              number: d.blocked.number,
              title: d.blocked.title,
              status: d.blocked.status,
              teamKey: d.blocked.team?.key ?? null,
            }))}
          />
        </Card>

        <Card className="p-5">
          <LinkedPages
            taskId={task.id}
            pages={task.wikiLinks.map((l) => ({
              id: l.page.id,
              title: l.page.title,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
