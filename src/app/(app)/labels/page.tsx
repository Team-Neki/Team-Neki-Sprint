import Link from "next/link";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { getLabels } from "@/server/queries";
import { deleteLabel } from "@/server/actions/labels";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LabelBadge } from "@/components/badges";
import { LabelDialog } from "@/components/labels/label-dialog";
import { ConfirmDelete } from "@/components/confirm-delete";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const labels = await getLabels();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="라벨"
        description="이슈를 가로지르는 태그입니다. 태스크 상세와 목록 필터에서 사용합니다."
      >
        <LabelDialog
          trigger={
            <Button>
              <Plus className="size-4" /> 새 라벨
            </Button>
          }
        />
      </PageHeader>

      {labels.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Tag className="text-muted-foreground size-6" />
          </div>
          <p className="text-muted-foreground text-sm">아직 라벨이 없습니다.</p>
          <LabelDialog
            trigger={
              <Button variant="outline">
                <Plus className="size-4" /> 첫 라벨 만들기
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="divide-border flex flex-col gap-0 divide-y py-0">
          {labels.map((l) => {
            const usage = l._count.tasks + l._count.epics + l._count.projects;
            async function handleDelete() {
              "use server";
              await deleteLabel(l.id);
            }
            return (
              <div
                key={l.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <LabelBadge name={l.name} color={l.color} />
                  <Link
                    href={`/tasks?label=${l.id}`}
                    className="text-muted-foreground hover:text-foreground text-xs hover:underline"
                  >
                    태스크 {l._count.tasks}
                  </Link>
                  <span className="text-muted-foreground text-xs">
                    총 사용 {usage}
                  </span>
                </div>
                <div className="flex shrink-0 items-center">
                  <LabelDialog
                    label={{ id: l.id, name: l.name, color: l.color }}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Pencil className="size-3.5" />
                      </Button>
                    }
                  />
                  <ConfirmDelete
                    onConfirm={handleDelete}
                    description="이 라벨을 삭제하면 모든 이슈에서 제거됩니다."
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    }
                  />
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
