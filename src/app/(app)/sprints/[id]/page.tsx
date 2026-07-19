import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  getSprint,
  getMembers,
  getSprintOptions,
  getEntityWikiLinks,
} from "@/server/queries";
import { deleteSprint } from "@/server/actions/sprints";
import { EntityLinkedPages } from "@/components/wiki/entity-linked-pages";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProjectsTable } from "@/components/tables/projects-table";
import { SprintStatusBadge } from "@/components/badges";
import { SprintDialog } from "@/components/forms/sprint-dialog";
import { ProjectDialog } from "@/components/forms/project-dialog";
import { ConfirmDelete } from "@/components/confirm-delete";

export const dynamic = "force-dynamic";

function dateRange(start: Date | null, end: Date | null) {
  const fmt = (d: Date) => format(d, "yyyy.M.d", { locale: ko });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `${fmt(start)} –`;
  if (end) return `– ${fmt(end)}`;
  return "기간 미설정";
}

export default async function SprintDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [sprint, members, sprints, wikiLinks] = await Promise.all([
    getSprint(id),
    getMembers(),
    getSprintOptions(),
    getEntityWikiLinks("sprint", id),
  ]);
  if (!sprint) notFound();

  async function handleDelete() {
    "use server";
    await deleteSprint(id);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/sprints"
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" /> 스프린트
      </Link>

      <PageHeader
        title={sprint.name}
        description={dateRange(sprint.startDate, sprint.endDate)}
      >
        <SprintDialog
          sprint={sprint}
          trigger={
            <Button variant="outline" size="sm">
              <Pencil className="size-4" /> 수정
            </Button>
          }
        />
        <ConfirmDelete
          onConfirm={handleDelete}
          redirectTo="/sprints"
          trigger={
            <Button variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="size-4" />
            </Button>
          }
        />
      </PageHeader>

      <div className="mb-6">
        <SprintStatusBadge status={sprint.status} />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">프로젝트 {sprint.projects.length}</h2>
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

      <Card className="overflow-hidden py-0">
        <ProjectsTable
          projects={sprint.projects}
          emptyMessage="연결된 프로젝트가 없습니다."
        />
      </Card>

      <Card className="mt-6 p-5">
        <EntityLinkedPages
          entityType="sprint"
          entityId={sprint.id}
          pages={wikiLinks}
        />
      </Card>
    </div>
  );
}
