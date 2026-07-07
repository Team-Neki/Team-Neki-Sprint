import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  getSprint,
  getMembers,
  getSprintOptions,
} from "@/server/queries";
import { deleteSprint } from "@/server/actions/sprints";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ItemRow, RowMeta } from "@/components/item-row";
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
  const [sprint, members, sprints] = await Promise.all([
    getSprint(id),
    getMembers(),
    getSprintOptions(),
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

      <div className="flex flex-col gap-2">
        {sprint.projects.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            연결된 프로젝트가 없습니다.
          </p>
        )}
        {sprint.projects.map((p) => (
          <ItemRow
            key={p.id}
            href={`/projects/${p.id}`}
            title={p.title}
            priority={p.priority}
            status={p.status}
            owner={p.owner}
            meta={
              <RowMeta className="w-16 sm:block">에픽 {p._count.epics}</RowMeta>
            }
          />
        ))}
      </div>
    </div>
  );
}
