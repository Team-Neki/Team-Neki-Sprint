import { Plus, Target } from "lucide-react";
import { getProjects, getMembers, getSprintOptions } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableRowLink } from "@/components/ui/table-row-link";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { UserBadge } from "@/components/user-badge";
import { MdRollupText } from "@/components/detail/md-rollup";
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
        <EmptyState members={members} sprints={sprints} />
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>제목</TableHead>
                <TableHead className="w-40">스프린트</TableHead>
                <TableHead className="w-20">우선순위</TableHead>
                <TableHead className="w-24">담당자</TableHead>
                <TableHead className="w-16 text-right">에픽</TableHead>
                <TableHead className="w-36 text-right">MD</TableHead>
                <TableHead className="w-24">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRowLink key={p.id} href={`/projects/${p.id}`}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell className="text-muted-foreground truncate text-xs">
                    {p.sprint?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={p.priority} />
                  </TableCell>
                  <TableCell>
                    <UserBadge user={p.owner} hideName />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                    {p._count.epics}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <MdRollupText
                      estimated={p.md.estimated}
                      actual={p.md.actual}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                </TableRowLink>
              ))}
            </TableBody>
          </Table>
        </Card>
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
