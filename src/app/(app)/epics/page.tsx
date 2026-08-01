import { Plus } from "lucide-react";
import type { Status } from "@prisma/client";
import {
  getEpics,
  getProjectOptions,
  getTeamOptions,
  getMembers,
  getLabelOptions,
  getColumnPref,
  getMe,
  EPIC_SORT_FIELDS,
} from "@/server/queries";
import { parseListSort } from "@/lib/list-sort";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EntityTable } from "@/components/tables/entity-table";
import {
  EPIC_COLUMNS,
  EPICS_COLUMNS_META,
  EPIC_DELETE_DESCRIPTION,
} from "@/components/tables/epic-columns";
import { ColumnSettings } from "@/components/tables/column-settings";
import { deleteEpic } from "@/server/actions/epics";
import { FilterBar } from "@/components/filters/filter-bar";
import { OwnerFilter } from "@/components/filters/owner-filter";
import { TeamFilter } from "@/components/filters/team-filter";
import { StatusFilter } from "@/components/filters/status-filter";
import { EpicDialog } from "@/components/forms/epic-dialog";

export const dynamic = "force-dynamic";

export default async function EpicsPage({
  searchParams,
}: {
  searchParams: Promise<{
    owner?: string;
    team?: string;
    status?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const sp = await searchParams;
  const sort = parseListSort(sp, EPIC_SORT_FIELDS);
  const user = await requireUser();
  // 다중선택 필터는 콤마구분 값(예: `?owner=a,b`) → 배열로 파싱한다(F6).
  const toArray = (v?: string) => (v ?? "").split(",").filter(Boolean);
  const hasFilter = !!(sp.owner || sp.team || sp.status);
  const [epics, projects, teams, members, labels, pref, me] = await Promise.all([
    getEpics({
      ownerId: toArray(sp.owner),
      teamId: toArray(sp.team),
      status: toArray(sp.status) as Status[],
      sort,
    }),
    getProjectOptions(),
    getTeamOptions(),
    getMembers(),
    getLabelOptions(),
    getColumnPref(user.id, "epics"),
    getMe(user.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="에픽"
        description="팀이 소유하는 작업 단위입니다. 표시 key는 팀 접두어를 따릅니다."
      >
        <EpicDialog
          members={members}
          teams={teams}
          projects={projects}
          me={me}
          trigger={
            <Button>
              <Plus className="size-4" /> 새 에픽
            </Button>
          }
        />
      </PageHeader>

      <div className="flex items-start justify-between gap-2">
        <FilterBar>
          <StatusFilter />
          <OwnerFilter members={members} />
          <TeamFilter teams={teams} />
        </FilterBar>
        <div className="mb-4 shrink-0">
          <ColumnSettings
            table="epics"
            available={EPICS_COLUMNS_META}
            pref={pref}
          />
        </div>
      </div>

      {/* 항목이 없어도 컬럼 헤더가 보이도록 항상 표를 렌더한다(빈 안내는 표 안 EmptyRow). */}
      <Card className="overflow-hidden py-0">
        <EntityTable
          rows={epics}
          columns={EPIC_COLUMNS}
          rowHref={(e) => `/epics/${e.id}`}
          emptyMessage={
            hasFilter
              ? "조건에 맞는 에픽이 없습니다. 필터를 조정하거나 초기화해 보세요."
              : "아직 에픽이 없습니다. 상단 ‘새 에픽’으로 만들어보세요."
          }
          edit={{ members, teams, projects, labels }}
          sortable
          columnPref={pref}
          deleteAction={deleteEpic}
          deleteDescription={EPIC_DELETE_DESCRIPTION}
        />
      </Card>
    </div>
  );
}
