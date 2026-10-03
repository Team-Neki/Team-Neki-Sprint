import { notFound } from "next/navigation";
import {
  getProject,
  getMembers,
  getTeamOptions,
  getSprintOptions,
  getProjectOptions,
  getLabelOptions,
  getEntityActivity,
  getEntityComments,
  getEntityWikiLinks,
  getMe,
} from "@/server/queries";
import { requireUser } from "@/lib/session";
import { deleteProject } from "@/server/actions/projects";
import { deleteEpic } from "@/server/actions/epics";
import { EntityLinkedPages } from "@/components/wiki/entity-linked-pages";
import { ProjectLabels } from "@/components/detail/project-labels";
import { Card } from "@/components/ui/card";
import { EntityTable } from "@/components/tables/entity-table";
import {
  EPIC_COLUMNS,
  EPIC_DELETE_DESCRIPTION,
} from "@/components/tables/epic-columns";
import { EpicDialog } from "@/components/forms/epic-dialog";
import { CommentsHistoryTabs } from "@/components/detail/comments-history-tabs";
import {
  DetailHeader,
  DetailDescription,
  ChildList,
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

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [
    project,
    members,
    teams,
    sprints,
    projects,
    labelOptions,
    activities,
    comments,
    wikiLinks,
    me,
  ] = await Promise.all([
    getProject(id),
    getMembers(),
    getTeamOptions(),
    getSprintOptions(),
    getProjectOptions(),
    getLabelOptions(),
    getEntityActivity("project", id),
    getEntityComments("project", id),
    getEntityWikiLinks("project", id),
    getMe(user.id),
  ]);
  if (!project) notFound();

  async function handleDelete() {
    "use server";
    await deleteProject(id);
  }

  return (
    <div className="@container/detail mx-auto max-w-5xl">
      <div className="grid gap-6 @3xl/detail:grid-cols-3">
      <div className="min-w-0 @3xl/detail:col-span-2">
        <DetailHeader
          href="/projects"
          label="프로젝트"
          title={
            <InlineTitle type="project" id={project.id} value={project.title} />
          }
          onDelete={handleDelete}
        />

        <DetailDescription
          type="project"
          id={project.id}
          value={project.description}
        />

        <ChildList
          label="에픽"
          count={project.epics.length}
          progress={project.progress}
          add={(trigger) => (
            <EpicDialog
              members={members}
              teams={teams}
              projects={projects}
              defaultProjectId={project.id}
              me={me}
              trigger={trigger}
            />
          )}
        >
          <EntityTable
            rows={project.epics}
            columns={EPIC_COLUMNS}
            rowHref={(e) => `/epics/${e.id}`}
            emptyMessage="연결된 에픽이 없습니다."
            edit={{ members, teams, projects, labels: labelOptions }}
            deleteAction={deleteEpic}
            deleteDescription={EPIC_DELETE_DESCRIPTION}
          />
        </ChildList>

        <CommentsHistoryTabs
          entityType="project"
          entityId={project.id}
          comments={comments}
          activities={activities}
          members={members}
          sprints={sprints.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4 @3xl/detail:col-span-1">
        <Card className="flex flex-col gap-3 p-5">
          <MetaRow label="상태">
            <InlineStatus
              type="project"
              id={project.id}
              value={project.status}
            />
          </MetaRow>
          <MetaRow label="담당자">
            <InlineMember
              type="project"
              id={project.id}
              field="ownerId"
              value={project.owner}
              members={members}
            />
          </MetaRow>
          <MetaRow label="우선순위">
            <InlinePriority
              type="project"
              id={project.id}
              value={project.priority}
            />
          </MetaRow>
          <MetaRow label="스프린트">
            <ParentField
              parent="sprint"
              id={project.id}
              value={project.sprintId}
              options={sprints.map((s) => ({ id: s.id, title: s.name }))}
            />
          </MetaRow>
          <MetaRow label="시작일">
            <InlineDate
              type="project"
              id={project.id}
              field="startDate"
              value={project.startDate}
            />
          </MetaRow>
          <MetaRow label="기한">
            <InlineDate
              type="project"
              id={project.id}
              field="dueDate"
              value={project.dueDate}
            />
          </MetaRow>
          <MdRollupRow md={project.md} />
          <MetaRow label="라벨" align="start">
            <ProjectLabels
              projectId={project.id}
              labels={project.labels.map((l) => l.label)}
              allLabels={labelOptions}
            />
          </MetaRow>
        </Card>

        <Card className="p-5">
          <EntityLinkedPages
            entityType="project"
            entityId={project.id}
            pages={wikiLinks}
          />
        </Card>
      </div>
      </div>
    </div>
  );
}
