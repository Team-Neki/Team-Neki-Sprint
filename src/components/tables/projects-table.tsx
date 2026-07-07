import type { Priority, Status } from "@prisma/client";
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
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { CountCell, MdCell, EmptyRow } from "./cells";

/**
 * 프로젝트 표의 한 행에 필요한 최소 데이터.
 * 프로젝트는 이슈 key 가 없다(팀 접두어 미부여). `sprint` 는 목록에서만 쓰고
 * 스프린트 상세의 하위 목록에서는 `hideSprint` 로 숨기므로 optional 이다.
 */
export type ProjectTableRow = {
  id: string;
  title: string;
  priority: Priority;
  status: Status;
  owner: MiniUser | null;
  sprint?: { name: string } | null;
  _count: { epics: number };
  md: { estimated: number; actual: number };
};

/**
 * 프로젝트 목록/하위목록 공용 표.
 * 컬럼: [제목] [스프린트?] [우선순위] [담당자] [에픽] [MD] [상태]
 * - 목록: 전체 컬럼. 스프린트 상세: `hideSprint` 로 스프린트 컬럼 숨김.
 */
export function ProjectsTable({
  projects,
  hideSprint = false,
  emptyMessage = "프로젝트가 없습니다.",
}: {
  projects: ProjectTableRow[];
  hideSprint?: boolean;
  emptyMessage?: string;
}) {
  const colSpan = hideSprint ? 6 : 7;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>제목</TableHead>
          {!hideSprint && <TableHead className="w-40">스프린트</TableHead>}
          <TableHead className="w-20">우선순위</TableHead>
          <TableHead className="w-24">담당자</TableHead>
          <TableHead className="w-16 text-right">에픽</TableHead>
          <TableHead className="w-36 text-right">MD</TableHead>
          <TableHead className="w-24">상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.length === 0 ? (
          <EmptyRow colSpan={colSpan} message={emptyMessage} />
        ) : (
          projects.map((p) => (
            <TableRowLink key={p.id} href={`/projects/${p.id}`}>
              <TableCell className="font-medium">{p.title}</TableCell>
              {!hideSprint && (
                <TableCell className="text-muted-foreground truncate text-xs">
                  {p.sprint?.name ?? "—"}
                </TableCell>
              )}
              <TableCell>
                <PriorityBadge priority={p.priority} />
              </TableCell>
              <TableCell>
                <UserBadge user={p.owner} hideName />
              </TableCell>
              <CountCell value={p._count.epics} />
              <MdCell estimated={p.md.estimated} actual={p.md.actual} />
              <TableCell>
                <StatusBadge status={p.status} />
              </TableCell>
            </TableRowLink>
          ))
        )}
      </TableBody>
    </Table>
  );
}
