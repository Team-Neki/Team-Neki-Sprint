import { notFound } from "next/navigation";
import {
  getSprint,
  getMembers,
  getSprintOptions,
  getLabelOptions,
  getEntityActivity,
  getEntityComments,
  getEntityWikiLinks,
} from "@/server/queries";
import { requireUser } from "@/lib/session";
import { deleteSprint } from "@/server/actions/sprints";
import { deleteProject } from "@/server/actions/projects";
import { EntityLinkedPages } from "@/components/wiki/entity-linked-pages";
import { Card } from "@/components/ui/card";
import { EntityTable } from "@/components/tables/entity-table";
import {
  PROJECT_COLUMNS,
  PROJECT_DELETE_DESCRIPTION,
} from "@/components/tables/project-columns";
import { ProjectDialog } from "@/components/forms/project-dialog";
import { CommentsHistoryTabs } from "@/components/detail/comments-history-tabs";
import {
  DetailHeader,
  DetailDescription,
  ChildList,
  MdRollupRow,
} from "@/components/detail/detail-shell";
import {
  MetaRow,
  InlineTitle,
  InlineSprintStatus,
  InlineDate,
} from "@/components/detail/inline-fields";

export const dynamic = "force-dynamic";

export default async function SprintDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const [sprint, members, sprints, labelOptions, activities, comments, wikiLinks] =
    await Promise.all([
      getSprint(id),
      getMembers(),
      getSprintOptions(),
      getLabelOptions(),
      getEntityActivity("sprint", id),
      getEntityComments("sprint", id),
      getEntityWikiLinks("sprint", id),
    ]);
  if (!sprint) notFound();

  async function handleDelete() {
    "use server";
    await deleteSprint(id);
  }

  return (
    <div className="@container/detail mx-auto max-w-5xl">
      <div className="grid gap-6 @3xl/detail:grid-cols-3">
      <div className="min-w-0 @3xl/detail:col-span-2">
        {/* 스프린트는 이슈 key 가 없다(팀 접두어 미부여) — 제목만. */}
        <DetailHeader
          href="/sprints"
          label="스프린트"
          title={
            <InlineTitle
              type="sprint"
              id={sprint.id}
              value={sprint.name}
              field="name"
            />
          }
          onDelete={handleDelete}
        />

        <DetailDescription
          type="sprint"
          id={sprint.id}
          value={sprint.description}
        />

        <ChildList
          label="프로젝트"
          count={sprint.projects.length}
          progress={sprint.progress}
          add={(trigger) => (
            <ProjectDialog
              members={members}
              sprints={sprints}
              defaultSprintId={sprint.id}
              trigger={trigger}
            />
          )}
        >
          <EntityTable
            rows={sprint.projects}
            columns={PROJECT_COLUMNS}
            rowHref={(p) => `/projects/${p.id}`}
            emptyMessage="연결된 프로젝트가 없습니다."
            edit={{
              members,
              sprints: sprints.map((s) => ({ id: s.id, name: s.name })),
              labels: labelOptions,
            }}
            deleteAction={deleteProject}
            deleteDescription={PROJECT_DELETE_DESCRIPTION}
          />
        </ChildList>

        <CommentsHistoryTabs
          entityType="sprint"
          entityId={sprint.id}
          comments={comments}
          activities={activities}
          members={members}
          sprints={sprints.map((s) => ({ id: s.id, name: s.name }))}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4 @3xl/detail:col-span-1">
        {/* 스프린트 모델에는 담당자·우선순위·팀이 없다 — 그 행들은 두지 않는다. */}
        <Card className="flex flex-col gap-3 p-5">
          <MetaRow label="상태">
            <InlineSprintStatus id={sprint.id} value={sprint.status} />
          </MetaRow>
          <MetaRow label="시작일">
            <InlineDate
              type="sprint"
              id={sprint.id}
              field="startDate"
              value={sprint.startDate}
            />
          </MetaRow>
          <MetaRow label="종료일">
            <InlineDate
              type="sprint"
              id={sprint.id}
              field="endDate"
              value={sprint.endDate}
            />
          </MetaRow>
          <MdRollupRow md={sprint.md} />
        </Card>

        <Card className="p-5">
          <EntityLinkedPages
            entityType="sprint"
            entityId={sprint.id}
            pages={wikiLinks}
          />
        </Card>
      </div>
      </div>
    </div>
  );
}
