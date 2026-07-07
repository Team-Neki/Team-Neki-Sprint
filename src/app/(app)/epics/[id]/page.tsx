import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronLeft } from "lucide-react";
import {
  getEpic,
  getProjectOptions,
  getTeamOptions,
  getMembers,
} from "@/server/queries";
import { deleteEpic } from "@/server/actions/epics";
import { formatIssueKey } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { UserBadge } from "@/components/user-badge";
import { PropertyBar } from "@/components/detail/property-bar";
import { EpicDialog } from "@/components/forms/epic-dialog";
import { TaskDialog } from "@/components/forms/task-dialog";
import { ConfirmDelete } from "@/components/confirm-delete";

export const dynamic = "force-dynamic";

export default async function EpicDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [epic, projects, teams, members] = await Promise.all([
    getEpic(id),
    getProjectOptions(),
    getTeamOptions(),
    getMembers(),
  ]);
  if (!epic) notFound();

  async function handleDelete() {
    "use server";
    await deleteEpic(id);
  }

  const issueKey = formatIssueKey(epic.team?.key, epic.number);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/epics"
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" /> 에픽
      </Link>

      <PageHeader title={epic.title} description={issueKey}>
        <EpicDialog
          members={members}
          teams={teams}
          projects={projects}
          epic={epic}
          trigger={
            <Button variant="outline" size="sm">
              <Pencil className="size-4" /> 수정
            </Button>
          }
        />
        <ConfirmDelete
          onConfirm={handleDelete}
          redirectTo="/epics"
          trigger={
            <Button variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="size-4" />
            </Button>
          }
        />
      </PageHeader>

      <div className="mb-6 flex flex-col gap-2">
        <PropertyBar
          type="epic"
          id={epic.id}
          status={epic.status}
          priority={epic.priority}
          assignee={epic.owner}
          members={members}
          startDate={epic.startDate}
          dueDate={epic.dueDate}
          team={epic.team}
        />
        {epic.project && (
          <p className="text-muted-foreground text-sm">
            프로젝트{" "}
            <Link
              href={`/projects/${epic.project.id}`}
              className="text-primary hover:underline"
            >
              {epic.project.title}
            </Link>
          </p>
        )}
      </div>

      {epic.description && (
        <Card className="mb-6 p-5">
          <p className="text-sm whitespace-pre-wrap">{epic.description}</p>
        </Card>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">태스크 {epic.tasks.length}</h2>
        <TaskDialog
          members={members}
          teams={teams}
          epics={[{ id: epic.id, title: epic.title, teamId: epic.teamId }]}
          defaultEpicId={epic.id}
          defaultTeamId={epic.teamId}
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="size-4" /> 태스크 추가
            </Button>
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        {epic.tasks.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            연결된 태스크가 없습니다.
          </p>
        )}
        {epic.tasks.map((t) => (
          <Link key={t.id} href={`/tasks/${t.id}`}>
            <Card className="hover:border-primary/40 flex flex-row items-center gap-3 px-4 py-3 transition-colors">
              <span className="text-muted-foreground w-24 shrink-0 font-mono text-xs">
                {formatIssueKey(t.team?.key, t.number)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {t.title}
              </span>
              <PriorityBadge priority={t.priority} />
              <UserBadge user={t.assignee} hideName />
              <StatusBadge status={t.status} />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
