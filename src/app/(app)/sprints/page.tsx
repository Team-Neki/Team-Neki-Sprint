import { Plus } from "lucide-react";
import type { SprintStatus } from "@prisma/client";
import { getSprints, getColumnPref, SPRINT_SORT_FIELDS } from "@/server/queries";
import { parseListSort } from "@/lib/list-sort";
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

export const dynamic = "force-dynamic";

export default async function SprintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const sort = parseListSort(sp, SPRINT_SORT_FIELDS);
  const user = await requireUser();
  // 다중선택 필터는 콤마구분 값(예: `?status=ACTIVE,PLANNED`) → 배열로 파싱한다(F6).
  const toArray = (v?: string) => (v ?? "").split(",").filter(Boolean);
  const hasFilter = !!sp.status;
  const [sprints, pref] = await Promise.all([
    getSprints({ status: toArray(sp.status) as SprintStatus[], sort }),
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

      {/* 항목이 없어도 컬럼 헤더가 보이도록 항상 표를 렌더한다(빈 안내는 표 안 EmptyRow). */}
      <Card className="overflow-hidden py-0">
        <EntityTable
          rows={sprints}
          columns={SPRINT_COLUMNS}
          rowHref={(s) => `/sprints/${s.id}`}
          emptyMessage={
            hasFilter
              ? "조건에 맞는 스프린트가 없습니다. 필터를 조정하거나 초기화해 보세요."
              : "아직 스프린트가 없습니다. 상단 ‘새 스프린트’로 만들어보세요."
          }
          sortable
          columnPref={pref}
          deleteAction={deleteSprint}
          deleteDescription={SPRINT_DELETE_DESCRIPTION}
        />
      </Card>
    </div>
  );
}
