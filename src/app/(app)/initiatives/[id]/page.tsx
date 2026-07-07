import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronLeft } from "lucide-react";
import { getInitiative, getMembers } from "@/server/queries";
import { deleteInitiative } from "@/server/actions/initiatives";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/badges";
import { UserBadge } from "@/components/user-badge";
import { PropertyBar } from "@/components/detail/property-bar";
import { InitiativeDialog } from "@/components/forms/initiative-dialog";
import { EpicDialog } from "@/components/forms/epic-dialog";
import { ConfirmDelete } from "@/components/confirm-delete";

export const dynamic = "force-dynamic";

export default async function InitiativeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [initiative, members] = await Promise.all([
    getInitiative(id),
    getMembers(),
  ]);
  if (!initiative) notFound();

  async function handleDelete() {
    "use server";
    await deleteInitiative(id);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/initiatives"
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" /> 이니셔티브
      </Link>

      <PageHeader title={initiative.title} description={`INI-${initiative.key}`}>
        <InitiativeDialog
          members={members}
          initiative={initiative}
          trigger={
            <Button variant="outline" size="sm">
              <Pencil className="size-4" /> 수정
            </Button>
          }
        />
        <ConfirmDelete
          onConfirm={handleDelete}
          redirectTo="/initiatives"
          trigger={
            <Button variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="size-4" />
            </Button>
          }
        />
      </PageHeader>

      <div className="mb-6">
        <PropertyBar
          type="initiative"
          id={initiative.id}
          status={initiative.status}
          priority={initiative.priority}
          assignee={initiative.owner}
          members={members}
          startDate={initiative.startDate}
          dueDate={initiative.dueDate}
        />
      </div>

      {initiative.description && (
        <Card className="mb-6 p-5">
          <p className="text-sm whitespace-pre-wrap">{initiative.description}</p>
        </Card>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">에픽 {initiative.epics.length}</h2>
        <EpicDialog
          members={members}
          initiatives={[{ id: initiative.id, title: initiative.title }]}
          defaultInitiativeId={initiative.id}
          trigger={
            <Button size="sm" variant="outline">
              <Plus className="size-4" /> 에픽 추가
            </Button>
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        {initiative.epics.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            연결된 에픽이 없습니다.
          </p>
        )}
        {initiative.epics.map((e) => (
          <Link key={e.id} href={`/epics/${e.id}`}>
            <Card className="hover:border-primary/40 flex flex-row items-center gap-3 px-4 py-3 transition-colors">
              <span className="text-muted-foreground w-20 shrink-0 font-mono text-xs">
                EPIC-{e.key}
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
