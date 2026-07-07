import { Plus, Target } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { getProjects, getMembers, getSprintOptions } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ItemRow, RowMeta } from "@/components/item-row";
import { OwnerFilter } from "@/components/filters/owner-filter";
import { ProjectDialog } from "@/components/forms/project-dialog";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
  const sp = await searchParams;
  const [projects, members, sprints] = await Promise.all([
    getProjects({ ownerId: sp.owner || undefined }),
    getMembers(),
    getSprintOptions(),
  ]);

  return (
    <div>
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
        <EmptyState members={members} sprints={sprints} />
      ) : (
        <div className="flex flex-col gap-2">
          {projects.map((p) => (
            <ItemRow
              key={p.id}
              href={`/projects/${p.id}`}
              title={p.title}
              priority={p.priority}
              status={p.status}
              owner={p.owner}
              meta={
                <>
                  {p.sprint && (
                    <RowMeta className="max-w-40 truncate md:block">
                      {p.sprint.name}
                    </RowMeta>
                  )}
                  <RowMeta className="w-16 sm:block">에픽 {p._count.epics}</RowMeta>
                  {p.dueDate && (
                    <RowMeta className="w-24 md:block">
                      ~{format(p.dueDate, "yy.M.d", { locale: ko })}
                    </RowMeta>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  members,
  sprints,
}: {
  members: Awaited<ReturnType<typeof getMembers>>;
  sprints: Awaited<ReturnType<typeof getSprintOptions>>;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 py-16">
      <div className="bg-muted flex size-12 items-center justify-center rounded-full">
        <Target className="text-muted-foreground size-6" />
      </div>
      <p className="text-muted-foreground text-sm">아직 프로젝트가 없습니다.</p>
      <ProjectDialog
        members={members}
        sprints={sprints}
        trigger={
          <Button variant="outline">
            <Plus className="size-4" /> 첫 프로젝트 만들기
          </Button>
        }
      />
    </Card>
  );
}
