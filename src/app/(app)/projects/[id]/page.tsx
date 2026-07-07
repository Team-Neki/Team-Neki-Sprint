import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronLeft } from "lucide-react";
import {
  getProject,
  getMembers,
  getTeamOptions,
  getSprintOptions,
  getProjectOptions,
} from "@/server/queries";
import { deleteProject } from "@/server/actions/projects";
import { formatIssueKey } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/badges";
import { UserBadge } from "@/components/user-badge";
import { PropertyBar } from "@/components/detail/property-bar";
import { ProjectDialog } from "@/components/forms/project-dialog";
import { EpicDialog } from "@/components/forms/epic-dialog";
import { ConfirmDelete } from "@/components/confirm-delete";

export const dynamic = "force-dynamic";

export default async function ProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, members, teams, sprints, projects] = await Promise.all([
    getProject(id),
    getMembers(),
    getTeamOptions(),
    getSprintOptions(),
    getProjectOptions(),
  ]);
  if (!project) notFound();

  async function handleDelete() {
    "use server";
    await deleteProject(id);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/projects"
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" /> 프로젝트
      </Link>

      <PageHeader
        title={project.title}
        description={project.sprint ? `스프린트 · ${project.sprint.name}` : "스프린트 미지정"}
      >
        <ProjectDialog
          members={members}
          sprints={sprints}
          project={project}
          trigger={
            <Button variant="outline" size="sm">
              <Pencil className="size-4" /> 수정
            </Button>
          }
        />
        <ConfirmDelete
          onConfirm={handleDelete}
          redirectTo="/projects"
          trigger={
            <Button variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="size-4" />
            </Button>
          }
        />
      </PageHeader>

      <div className="mb-6">
        <PropertyBar
          type="project"
          id={project.id}
          status={project.status}
          priority={project.priority}
          assignee={project.owner}
          members={members}
          startDate={project.startDate}
          dueDate={project.dueDate}
        />
      </div>

      {project.description && (
        <Card className="mb-6 p-5">
          <p className="text-sm whitespace-pre-wrap">{project.description}</p>
        </Card>
      )}

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

      <div className="flex flex-col gap-2">
        {project.epics.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            연결된 에픽이 없습니다.
          </p>
        )}
        {project.epics.map((e) => (
          <Link key={e.id} href={`/epics/${e.id}`}>
            <Card className="hover:border-primary/40 flex flex-row items-center gap-3 px-4 py-3 transition-colors">
              <span className="text-muted-foreground w-24 shrink-0 font-mono text-xs">
                {formatIssueKey(e.team?.key, e.number)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {e.title}
              </span>
              <span className="text-muted-foreground text-xs">
                태스크 {e._count.tasks}
              </span>
              <UserBadge user={e.owner} hideName />
              <StatusBadge status={e.status} />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
