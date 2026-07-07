import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Trash2, ChevronLeft } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { getTask, getEpics, getMembers } from "@/server/queries";
import { deleteTask } from "@/server/actions/tasks";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { UserBadge } from "@/components/user-badge";
import { TaskDialog } from "@/components/forms/task-dialog";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CommentForm } from "@/components/tasks/comment-form";

export const dynamic = "force-dynamic";

export default async function TaskDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [task, epics, members] = await Promise.all([
    getTask(id),
    getEpics(),
    getMembers(),
  ]);
  if (!task) notFound();

  async function handleDelete() {
    "use server";
    await deleteTask(id);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Link
          href="/board"
          className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" /> 보드
        </Link>

        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <span className="text-muted-foreground font-mono text-xs">
              TASK-{task.key}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              {task.title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <TaskDialog
              members={members}
              epics={epics.map((e) => ({ id: e.id, title: e.title }))}
              task={task}
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil className="size-4" /> 수정
                </Button>
              }
            />
            <ConfirmDelete
              onConfirm={handleDelete}
              redirectTo="/board"
              trigger={
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 className="size-4" />
                </Button>
              }
            />
          </div>
        </div>

        <Card className="mb-6 p-5">
          <h3 className="mb-2 text-sm font-medium">설명</h3>
          {task.description ? (
            <p className="text-sm whitespace-pre-wrap">{task.description}</p>
          ) : (
            <p className="text-muted-foreground text-sm">설명이 없습니다.</p>
          )}
        </Card>

        <h3 className="mb-3 text-sm font-medium">
          댓글 {task.comments.length}
        </h3>
        <div className="mb-4 flex flex-col gap-4">
          {task.comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <UserBadge user={c.author} hideName />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {c.author.name ?? c.author.email}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDistanceToNow(c.createdAt, {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </span>
                </div>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
        <CommentForm taskId={task.id} />
      </div>

      <div className="lg:col-span-1">
        <Card className="flex flex-col gap-4 p-5">
          <Field label="상태">
            <StatusBadge status={task.status} />
          </Field>
          <Separator />
          <Field label="담당자">
            <UserBadge user={task.assignee} />
          </Field>
          <Field label="보고자">
            <UserBadge user={task.reporter} />
          </Field>
          <Field label="우선순위">
            <PriorityBadge priority={task.priority} />
          </Field>
          {task.storyPoints != null && (
            <Field label="스토리 포인트">
              <span className="text-sm">{task.storyPoints}</span>
            </Field>
          )}
          <Field label="에픽">
            {task.epic ? (
              <Link
                href={`/epics/${task.epic.id}`}
                className="text-primary text-sm hover:underline"
              >
                {task.epic.title}
              </Link>
            ) : (
              <span className="text-muted-foreground text-sm">없음</span>
            )}
          </Field>
          {task.dueDate && (
            <Field label="마감일">
              <span className="text-sm">
                {format(task.dueDate, "yyyy.M.d", { locale: ko })}
              </span>
            </Field>
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  );
}
