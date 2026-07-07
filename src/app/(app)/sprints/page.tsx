import { Plus, Rocket } from "lucide-react";
import { getSprints } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SprintsTable } from "@/components/tables/sprints-table";
import { SprintDialog } from "@/components/forms/sprint-dialog";

export const dynamic = "force-dynamic";

export default async function SprintsPage() {
  const sprints = await getSprints();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="스프린트"
        description="기간 단위로 팀 횡단 프로젝트를 묶어 관리합니다."
      >
        <SprintDialog
          trigger={
            <Button>
              <Plus className="size-4" /> 새 스프린트
            </Button>
          }
        />
      </PageHeader>

      {sprints.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Rocket className="text-muted-foreground size-6" />
          </div>
          <p className="text-muted-foreground text-sm">아직 스프린트가 없습니다.</p>
          <SprintDialog
            trigger={
              <Button variant="outline">
                <Plus className="size-4" /> 첫 스프린트 만들기
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <SprintsTable sprints={sprints} />
        </Card>
      )}
    </div>
  );
}
