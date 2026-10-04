import { notFound } from "next/navigation";
import {
  getEpic,
  getProjectOptions,
  getTeamOptions,
  getMembers,
  getEntityActivity,
  getLabelOptions,
  getEntityComments,
  getEntityWikiLinks,
} from "@/server/queries";
import { requireUser } from "@/lib/session";
import { deleteEpic } from "@/server/actions/epics";
import { deleteTask } from "@/server/actions/tasks";
import { EpicLabels } from "@/components/detail/epic-labels";
import { EntityLinkedPages } from "@/components/wiki/entity-linked-pages";
import { formatIssueKey } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { EntityTable } from "@/components/tables/entity-table";
import { TASK_COLUMNS } from "@/components/tables/task-columns";
import { TaskDialog } from "@/components/forms/task-dialog";
import { CommentsHistoryTabs } from "@/components/detail/comments-history-tabs";
import {
  DetailHeader,
  DetailDescription,
  ChildList,
  TeamRow,
  MdRollupRow,
} from "@/components/detail/detail-shell";
import { ParentField } from "@/components/detail/parent-field";
import {
  MetaRow,
  InlineTitle,
  InlineStatus,
  InlinePriority,
  InlineMember,
  InlineDate,
} from "@/components/detail/inline-fields";

export const dynamic = "force-dynamic";

export default async function EpicDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const [
    epic,
    projects,
    teams,
    members,
    activities,
    labelOptions,
    comments,
    wikiLinks,
  ] = await Promise.all([
    getEpic(id),
    getProjectOptions(),
    getTeamOptions(),
    getMembers(),
    getEntityActivity("epic", id),
    getLabelOptions(),
    getEntityComments("epic", id),
    getEntityWikiLinks("epic", id),
  ]);
  if (!epic) notFound();

  async function handleDelete() {
    "use server";
    await deleteEpic(id);
  }

  return (
    <div className="@container/detail mx-auto max-w-5xl">
      <div className="grid gap-6 @3xl/detail:grid-cols-3">
      <div className="min-w-0 @3xl/detail:col-span-2">
        <DetailHeader
          href="/epics"
          label="에픽"
          issueKey={formatIssueKey(epic.team?.key, epic.number)}
          title={<InlineTitle type="epic" id={epic.id} value={epic.title} />}
          onDelete={handleDelete}
        />

        <DetailDescription type="epic" id={epic.id} value={epic.description} />

        <ChildList
          label="태스크"
          count={epic.tasks.length}
          progress={epic.progress}
          add={(trigger) => (
            <TaskDialog
              members={members}
              teams={teams}
              epics={[{ id: epic.id, title: epic.title, teamId: epic.teamId }]}
              defaultEpicId={epic.id}
              defaultTeamId={epic.teamId}
              trigger={trigger}
            />
          )}
        >
          <EntityTable
            rows={epic.tasks}
            columns={TASK_COLUMNS}
            rowHref={(t) => `/tasks/${t.id}`}
            emptyMessage="연결된 태스크가 없습니다."
            edit={{
              members,
              teams,
              epics: [
                { id: epic.id, title: epic.title, teamId: epic.teamId },
              ],
              labels: labelOptions,
            }}
            deleteAction={deleteTask}
          />
        </ChildList>

        <CommentsHistoryTabs
          entityType="epic"
          entityId={epic.id}
          comments={comments}
          activities={activities}
          members={members}
          projects={projects.map((p) => ({ id: p.id, title: p.title }))}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4 @3xl/detail:col-span-1">
        <Card className="flex flex-col gap-3 p-5">
          <MetaRow label="상태">
            <InlineStatus type="epic" id={epic.id} value={epic.status} />
          </MetaRow>
          <MetaRow label="담당자">
            <InlineMember
              type="epic"
              id={epic.id}
              field="ownerId"
              value={epic.owner}
              members={members}
            />
          </MetaRow>
          <MetaRow label="우선순위">
            <InlinePriority type="epic" id={epic.id} value={epic.priority} />
          </MetaRow>
          <MetaRow label="프로젝트">
            <ParentField
              parent="project"
              id={epic.id}
              value={epic.projectId}
              options={projects}
            />
          </MetaRow>
          <MetaRow label="시작일">
            <InlineDate
              type="epic"
              id={epic.id}
              field="startDate"
              value={epic.startDate}
            />
          </MetaRow>
          <MetaRow label="기한">
            <InlineDate
              type="epic"
              id={epic.id}
              field="dueDate"
              value={epic.dueDate}
            />
          </MetaRow>
          <TeamRow team={epic.team} />
          <MdRollupRow md={epic.md} />
          <MetaRow label="라벨" align="start">
            <EpicLabels
              epicId={epic.id}
              labels={epic.labels.map((l) => l.label)}
              allLabels={labelOptions}
            />
          </MetaRow>
        </Card>

        <Card className="p-5">
          <EntityLinkedPages
            entityType="epic"
            entityId={epic.id}
            pages={wikiLinks}
          />
        </Card>
      </div>
      </div>
    </div>
  );
}
