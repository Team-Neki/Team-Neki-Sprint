import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { getEpic, getInitiatives, getMembers } from "@/server/queries";
import { deleteEpic } from "@/server/actions/epics";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { UserBadge } from "@/components/user-badge";
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
  const [epic, initiatives, members] = await Promise.all([
    getEpic(id),
    getInitiatives(),
    getMembers(),
  ]);
  if (!epic) notFound();

  async function handleDelete() {
    "use server";
    await deleteEpic(id);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/epics"
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" /> 에픽
      </Link>

      <PageHeader title={epic.title}>
        <EpicDialog
          members={members}
          initiatives={initiatives.map((i) => ({ id: i.id, title: i.title }))}
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

      <Card className="mb-6 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Meta label="상태">
          <StatusBadge status={epic.status} />
        </Meta>
        <Meta label="우선순위">
          <PriorityBadge priority={epic.priority} />
        </Meta>
        <Meta label="담당자">
          <UserBadge user={epic.owner} />
        </Meta>
        <Meta label="이니셔티브">
          {epic.initiative ? (
            <Link
              href={`/initiatives/${epic.initiative.id}`}
              className="text-primary truncate text-sm hover:underline"
            >
              {epic.initiative.title}
            </Link>
          ) : (
            <span className="text-muted-foreground text-sm">없음</span>
          )}
        </Meta>
        {epic.dueDate && (
          <Meta label="종료일">
            <span className="text-sm">
              {format(epic.dueDate, "yyyy.M.d", { locale: ko })}
            </span>
          </Meta>
        )}
      </Card>

      {epic.description && (
        <Card className="mb-6 p-5">
          <p className="text-sm whitespace-pre-wrap">{epic.description}</p>
        </Card>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">태스크 {epic.tasks.length}</h2>
        <TaskDialog
          members={members}
          epics={[{ id: epic.id, title: epic.title }]}
          defaultEpicId={epic.id}
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
              <span className="text-muted-foreground w-20 shrink-0 font-mono text-xs">
                TASK-{t.key}
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

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  );
}
