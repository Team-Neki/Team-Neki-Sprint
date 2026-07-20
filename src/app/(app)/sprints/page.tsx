import { Plus, Rocket } from "lucide-react";
import { getSprints, getColumnPref } from "@/server/queries";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  SprintsTable,
  SPRINTS_COLUMNS_META,
} from "@/components/tables/sprints-table";
import { ColumnSettings } from "@/components/tables/column-settings";
import { SprintDialog } from "@/components/forms/sprint-dialog";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default async function SprintsPage() {
  const user = await requireUser();
  const [sprints, pref] = await Promise.all([
    getSprints(),
    getColumnPref(user.id, "sprints"),
  ]);

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
        <>
          <div className="mb-4 flex justify-end">
            <ColumnSettings
              table="sprints"
              available={SPRINTS_COLUMNS_META}
              pref={pref}
            />
          </div>
          <Card className="overflow-hidden py-0">
            <SprintsTable sprints={sprints} columnPref={pref} />
          </Card>
        </>
      )}
    </div>
  );
}
