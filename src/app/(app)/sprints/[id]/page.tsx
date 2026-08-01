import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import {
  getSprint,
  getMembers,
  getSprintOptions,
  getLabelOptions,
  getEntityActivity,
  getEntityComments,
  getEntityWikiLinks,
} from "@/server/queries";
import { deleteSprint } from "@/server/actions/sprints";
import { deleteProject } from "@/server/actions/projects";
import { EntityLinkedPages } from "@/components/wiki/entity-linked-pages";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EntityTable } from "@/components/tables/entity-table";
import {
  PROJECT_COLUMNS,
  PROJECT_DELETE_DESCRIPTION,
} from "@/components/tables/project-columns";
import { ProjectDialog } from "@/components/forms/project-dialog";
import { SheetDeleteButton } from "@/components/detail/sheet-delete-button";
import { BackButton } from "@/components/detail/back-button";
import { CommentsHistoryTabs } from "@/components/detail/comments-history-tabs";
import { MdRollupText } from "@/components/detail/md-rollup";
import {
  MetaRow,
  InlineTitle,
  InlineDescription,
  InlineSprintStatus,
  InlineDate,
} from "@/components/detail/inline-fields";

export const dynamic = "force-dynamic";

export default async function SprintDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
        <BackButton fallback="/sprints" label="스프린트" />

        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* 스프린트는 이슈 key 가 없다(팀 접두어 미부여) — 제목만. */}
            <InlineTitle
              type="sprint"
              id={sprint.id}
              value={sprint.name}
              field="name"
            />
          </div>
          <SheetDeleteButton onConfirm={handleDelete} redirectTo="/sprints" />
        </div>

        <Card className="mb-6 p-5">
          <h3 className="mb-2 text-sm font-medium">설명</h3>
          <InlineDescription
            type="sprint"
            id={sprint.id}
            value={sprint.description}
          />
        </Card>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            프로젝트 {sprint.projects.length}
          </h2>
          <ProjectDialog
            members={members}
            sprints={sprints}
            defaultSprintId={sprint.id}
            trigger={
              <Button size="sm" variant="outline">
                <Plus className="size-4" /> 프로젝트 추가
              </Button>
            }
          />
        </div>

        <Card className="mb-6 overflow-hidden py-0">
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
        </Card>

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
          <MetaRow label="MD (롤업)">
            <MdRollupText
              estimated={sprint.md.estimated}
              actual={sprint.md.actual}
              className="text-sm"
            />
          </MetaRow>
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
