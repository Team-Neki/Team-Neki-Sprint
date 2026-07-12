import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import {
  getProject,
  getMembers,
  getTeamOptions,
  getSprintOptions,
  getProjectOptions,
  getEntityActivity,
} from "@/server/queries";
import { deleteProject } from "@/server/actions/projects";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EpicsTable } from "@/components/tables/epics-table";
import { EpicDialog } from "@/components/forms/epic-dialog";
import { SheetDeleteButton } from "@/components/detail/sheet-delete-button";
import { BackButton } from "@/components/detail/back-button";
import { HistoryPanel } from "@/components/detail/history-panel";
import { MdRollupText } from "@/components/detail/md-rollup";
import {
  MetaRow,
  InlineTitle,
  InlineDescription,
  InlineStatus,
  InlinePriority,
  InlineMember,
  InlineLink,
  InlineDate,
} from "@/components/detail/inline-fields";

export const dynamic = "force-dynamic";

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, members, teams, sprints, projects, activities] =
    await Promise.all([
      getProject(id),
      getMembers(),
      getTeamOptions(),
      getSprintOptions(),
      getProjectOptions(),
      getEntityActivity("project", id),
    ]);
  if (!project) notFound();

  async function handleDelete() {
    "use server";
    await deleteProject(id);
  }

  return (
    <div className="@container/detail mx-auto max-w-5xl">
      <div className="grid gap-6 @3xl/detail:grid-cols-3">
      <div className="@3xl/detail:col-span-2">
        <BackButton fallback="/projects" label="프로젝트" />

        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <InlineTitle type="project" id={project.id} value={project.title} />
          </div>
          <SheetDeleteButton onConfirm={handleDelete} redirectTo="/projects" />
        </div>

        <Card className="mb-6 p-5">
          <h3 className="mb-2 text-sm font-medium">설명</h3>
          <InlineDescription
            type="project"
            id={project.id}
            value={project.description}
          />
        </Card>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">에픽 {project.epics.length}</h2>
          <EpicDialog
            members={members}
            teams={teams}
            projects={projects}
            defaultProjectId={project.id}
            trigger={
              <Button size="sm" variant="outline">
                <Plus className="size-4" /> 에픽 추가
              </Button>
            }
          />
        </div>

        <Card className="mb-6 overflow-hidden py-0">
          <EpicsTable
            epics={project.epics}
            emptyMessage="연결된 에픽이 없습니다."
          />
        </Card>

        <Card className="p-5">
          <HistoryPanel
            activities={activities}
            members={members}
            sprints={sprints.map((s) => ({ id: s.id, name: s.name }))}
          />
        </Card>
      </div>

      <div className="@3xl/detail:col-span-1">
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
            <InlineLink
              type="project"
              id={project.id}
              field="sprintId"
              value={project.sprintId}
              options={sprints.map((s) => ({ id: s.id, label: s.name }))}
              noneLabel="미지정"
              placeholder="스프린트 선택"
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
          <MetaRow label="MD (롤업)">
            <MdRollupText
              estimated={project.md.estimated}
              actual={project.md.actual}
              className="text-sm"
            />
          </MetaRow>
        </Card>
      </div>
      </div>
    </div>
  );
}
