import { Plus, Target } from "lucide-react";
import {
  getProjects,
  getMembers,
  getSprintOptions,
  getLabelOptions,
  type ProjectSortField,
} from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProjectsTable } from "@/components/tables/projects-table";
import { OwnerFilter } from "@/components/filters/owner-filter";
import { ProjectDialog } from "@/components/forms/project-dialog";
import { EmptyState } from "@/components/empty-state";

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
  const [projects, members, sprints, labels] = await Promise.all([
    getProjects({ ownerId: sp.owner || undefined, sort }),
    getMembers(),
    getSprintOptions(),
    getLabelOptions(),
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

      <OwnerFilter members={members} />

      {projects.length === 0 ? (
        <EmptyState
          icon={Target}
          title="아직 프로젝트가 없습니다"
          description="첫 프로젝트를 만들어 에픽을 묶어보세요."
          action={
            <ProjectDialog
              members={members}
              sprints={sprints}
              trigger={
                <Button variant="outline">
                  <Plus className="size-4" /> 첫 프로젝트 만들기
                </Button>
              }
            />
          }
        />
      ) : (
        <Card className="overflow-hidden py-0">
          <ProjectsTable
            projects={projects}
            edit={{ members, sprints, labels }}
          />
        </Card>
      )}
    </div>
  );
}
