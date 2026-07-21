import { Plus } from "lucide-react";
import {
  getProjects,
  getMembers,
  getSprintOptions,
  getLabelOptions,
  getColumnPref,
  type ProjectSortField,
} from "@/server/queries";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EntityTable } from "@/components/tables/entity-table";
import {
  PROJECT_COLUMNS,
  PROJECTS_COLUMNS_META,
  PROJECT_DELETE_DESCRIPTION,
} from "@/components/tables/project-columns";
import { ColumnSettings } from "@/components/tables/column-settings";
import { deleteProject } from "@/server/actions/projects";
import { OwnerFilter } from "@/components/filters/owner-filter";
import { ProjectDialog } from "@/components/forms/project-dialog";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; sort?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const SORT_FIELDS: ProjectSortField[] = [
    "title",
    "status",
    "priority",
    "dueDate",
    "createdAt",
    "updatedAt",
  ];
  const sortField = SORT_FIELDS.find((f) => f === sp.sort);
  const sort = sortField
    ? { field: sortField, dir: sp.dir === "asc" ? ("asc" as const) : ("desc" as const) }
    : undefined;
  const user = await requireUser();
  // 다중선택 필터는 콤마구분 값(예: `?owner=a,b`) → 배열로 파싱한다(F6).
  const toArray = (v?: string) => (v ?? "").split(",").filter(Boolean);
  const [projects, members, sprints, labels, pref] = await Promise.all([
    getProjects({ ownerId: toArray(sp.owner), sort }),
    getMembers(),
    getSprintOptions(),
    getLabelOptions(),
    getColumnPref(user.id, "projects"),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="프로젝트"
        description="스프린트 안의 팀 횡단 작업입니다. 하위에 팀별 에픽·태스크가 연결됩니다."
      >
        <ProjectDialog
          members={members}
          sprints={sprints}
          trigger={
            <Button>
              <Plus className="size-4" /> 새 프로젝트
            </Button>
          }
        />
      </PageHeader>

      <div className="flex items-start justify-between gap-2">
        <OwnerFilter members={members} />
        <div className="mb-4 shrink-0">
          <ColumnSettings
            table="projects"
            available={PROJECTS_COLUMNS_META}
            pref={pref}
          />
        </div>
      </div>

      {/* 항목이 없어도 컬럼 헤더가 보이도록 항상 표를 렌더한다(빈 안내는 표 안 EmptyRow). */}
      <Card className="overflow-hidden py-0">
        <EntityTable
          rows={projects}
          columns={PROJECT_COLUMNS}
          rowHref={(p) => `/projects/${p.id}`}
          emptyMessage="아직 프로젝트가 없습니다. 상단 ‘새 프로젝트’로 만들어보세요."
          edit={{ members, sprints, labels }}
          sortable
          columnPref={pref}
          deleteAction={deleteProject}
          deleteDescription={PROJECT_DELETE_DESCRIPTION}
        />
      </Card>
    </div>
  );
}
