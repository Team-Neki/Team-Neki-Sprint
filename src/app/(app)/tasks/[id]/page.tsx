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
import { requireUser } from "@/lib/session";
import { deleteTask } from "@/server/actions/tasks";
import { formatIssueKey } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { EntityLinkedPages } from "@/components/wiki/entity-linked-pages";
import { CommentsHistoryTabs } from "@/components/detail/comments-history-tabs";
import {
  DetailHeader,
  DetailDescription,
  TeamRow,
} from "@/components/detail/detail-shell";
import { ParentField } from "@/components/detail/parent-field";
import { InlineAssignee } from "@/components/detail/inline-assignee";
import { TaskLabels } from "@/components/detail/task-labels";
import { TaskCc } from "@/components/detail/task-cc";
import { TaskDependencies } from "@/components/detail/task-dependencies";
import { TaskGithub } from "@/components/detail/task-github";
import {
  MetaRow,
  FieldHint,
  InlineTitle,
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
  await requireUser();
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

  const epicOptions = epics.map((e) => ({
    id: e.id,
    title: e.title,
    issueKey: formatIssueKey(e.team?.key, e.number),
  }));

  async function handleDelete() {
    "use server";
    await deleteTask(id);
  }

  return (
    <div className="@container/detail mx-auto max-w-5xl">
      <div className="grid gap-6 @3xl/detail:grid-cols-3">
      <div className="min-w-0 @3xl/detail:col-span-2">
        <DetailHeader
          href="/tasks"
          label="태스크"
          issueKey={formatIssueKey(task.team?.key, task.number)}
          title={<InlineTitle type="task" id={task.id} value={task.title} />}
          onDelete={handleDelete}
        />

        <DetailDescription type="task" id={task.id} value={task.description} />

        <CommentsHistoryTabs
          entityType="task"
          entityId={task.id}
          comments={task.comments}
          activities={activities}
          members={members}
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          epics={epics.map((e) => ({ id: e.id, title: e.title }))}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4 @3xl/detail:col-span-1">
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
            <ParentField
              parent="epic"
              id={task.id}
              value={task.epicId}
              options={epicOptions}
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
          <TeamRow team={task.team} />
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
