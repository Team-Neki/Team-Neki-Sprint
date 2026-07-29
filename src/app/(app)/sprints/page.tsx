import { Plus, Rocket } from "lucide-react";
import type { SprintStatus } from "@prisma/client";
import { getSprints, getColumnPref } from "@/server/queries";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EntityTable } from "@/components/tables/entity-table";
import {
  SPRINT_COLUMNS,
  SPRINTS_COLUMNS_META,
  SPRINT_DELETE_DESCRIPTION,
} from "@/components/tables/sprint-columns";
import { ColumnSettings } from "@/components/tables/column-settings";
import { StatusFilter } from "@/components/filters/status-filter";
import { deleteSprint } from "@/server/actions/sprints";
import { SprintDialog } from "@/components/forms/sprint-dialog";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

export default async function SprintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  // 다중선택 필터는 콤마구분 값(예: `?status=ACTIVE,PLANNED`) → 배열로 파싱한다(F6).
  const toArray = (v?: string) => (v ?? "").split(",").filter(Boolean);
  const hasFilter = !!sp.status;
  const [sprints, pref] = await Promise.all([
    getSprints({ status: toArray(sp.status) as SprintStatus[] }),
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

      {/* 필터가 걸린 상태에서 결과가 0이면 EmptyState(생성 CTA) 대신 표를 유지해
          필터를 조정할 수 있게 한다 — 표 안 EmptyRow 가 안내 문구를 보여준다. */}
      {sprints.length === 0 && !hasFilter ? (
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
          <div className="flex items-start justify-between gap-2">
            <StatusFilter kind="sprint" />
            <div className="mb-4 shrink-0">
              <ColumnSettings
                table="sprints"
                available={SPRINTS_COLUMNS_META}
                pref={pref}
              />
            </div>
          </div>
          <Card className="overflow-hidden py-0">
            <EntityTable
              rows={sprints}
              columns={SPRINT_COLUMNS}
              rowHref={(s) => `/sprints/${s.id}`}
              emptyMessage={
                hasFilter
                  ? "조건에 맞는 스프린트가 없습니다. 필터를 조정하거나 초기화해 보세요."
                  : "스프린트가 없습니다."
              }
              columnPref={pref}
              deleteAction={deleteSprint}
              deleteDescription={SPRINT_DELETE_DESCRIPTION}
            />
          </Card>
        </>
      )}
    </div>
  );
}
