import { Plus, Rocket } from "lucide-react";
import { getSprints } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SprintsTable } from "@/components/tables/sprints-table";
import { SprintDialog } from "@/components/forms/sprint-dialog";
import { EmptyState } from "@/components/empty-state";

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
        <EmptyState
          icon={Rocket}
          title="아직 스프린트가 없습니다"
          description="첫 스프린트를 만들어 기간 단위로 작업을 묶어보세요."
          action={
            <SprintDialog
              trigger={
                <Button variant="outline">
                  <Plus className="size-4" /> 첫 스프린트 만들기
                </Button>
              }
            />
          }
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <SprintsTable sprints={sprints} />
        </Card>
      )}
    </div>
  );
}
