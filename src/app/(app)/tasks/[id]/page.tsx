import { notFound } from "next/navigation";
import {
  getTask,
  getEpicOptions,
  getMembers,
  getTeamOptions,
  getEntityActivity,
  getLabelOptions,
  getTaskGithubLinks,
} from "@/server/queries";
import { deleteTask } from "@/server/actions/tasks";
import { formatIssueKey } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { SheetDeleteButton } from "@/components/detail/sheet-delete-button";
import { EntityComments } from "@/components/comments/entity-comments";
import { EntityLinkedPages } from "@/components/wiki/entity-linked-pages";
import { BackButton } from "@/components/detail/back-button";
import { HistoryPanel } from "@/components/detail/history-panel";
import { EpicField } from "@/components/detail/epic-field";
import { InlineAssignee } from "@/components/detail/inline-assignee";
import { TaskLabels } from "@/components/detail/task-labels";
import { TaskCc } from "@/components/detail/task-cc";
import { TaskDependencies } from "@/components/detail/task-dependencies";
import { TaskGithub } from "@/components/detail/task-github";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  MetaRow,
  FieldHint,
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
  const [task, epics, members, teams, activities, labelOptions, githubLinks] =
    await Promise.all([
      getTask(id),
      getEpicOptions(),
      getMembers(),
      getTeamOptions(),
      getEntityActivity("task", id),
      getLabelOptions(),
      getTaskGithubLinks(id),
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
    <div className="@container/detail mx-auto max-w-5xl">
      <div className="grid gap-6 @3xl/detail:grid-cols-3">
      <div className="@3xl/detail:col-span-2">
        <BackButton fallback="/board" label="보드" />

        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-muted-foreground font-mono text-xs">
              {formatIssueKey(task.team?.key, task.number)}
            </span>
            <InlineTitle type="task" id={task.id} value={task.title} />
          </div>
          <SheetDeleteButton onConfirm={handleDelete} redirectTo="/board" />
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
            <EntityComments
              entityType="task"
              entityId={task.id}
              comments={task.comments}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <HistoryPanel
              activities={activities}
              members={members}
              teams={teams.map((t) => ({ id: t.id, name: t.name }))}
              epics={epics.map((e) => ({ id: e.id, title: e.title }))}
              title=""
            />
          </TabsContent>
        </Tabs>
      </div>

      <div className="@3xl/detail:col-span-1 flex flex-col gap-4">
        <Card className="flex flex-col gap-3 p-5">
          <MetaRow label="상태">
            <InlineStatus type="task" id={task.id} value={task.status} />
          </MetaRow>
          <MetaRow label="담당자">
            <InlineAssignee
              taskId={task.id}
              user={task.assignee}
              team={task.assigneeTeam}
              members={members}
              teams={teams}
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
          <MetaRow label="참조 (c.c.)" align="start">
            <TaskCc taskId={task.id} value={task.ccUsers} members={members} />
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
          <MetaRow
            label={
              <FieldHint
                hint={
                  <>
                    <span>1md = 8h</span>
                    <span>예측 산정 시간</span>
                  </>
                }
              >
                예상 MD
              </FieldHint>
            }
          >
            <InlineNumber
              type="task"
              id={task.id}
              field="estimatedMd"
              value={task.estimatedMd}
            />
          </MetaRow>
          <MetaRow
            label={
              <FieldHint
                hint={
                  <>
                    <span>1md = 8h</span>
                    <span>실제 산정 시간</span>
                  </>
                }
              >
                실제 MD
              </FieldHint>
            }
          >
            <InlineNumber
              type="task"
              id={task.id}
              field="actualMd"
              value={task.actualMd}
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
          <TaskGithub
            taskId={task.id}
            issueKey={formatIssueKey(task.team?.key, task.number)}
            title={task.title}
            links={githubLinks}
          />
        </Card>

        <Card className="p-5">
          <EntityLinkedPages
            entityType="task"
            entityId={task.id}
            pages={task.wikiLinks.map((l) => ({
              id: l.page.id,
              title: l.page.title,
            }))}
          />
        </Card>
      </div>
      </div>
    </div>
  );
}
