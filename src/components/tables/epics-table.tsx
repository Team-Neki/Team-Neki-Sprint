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
import { KeyCell, CountCell, MdCell, EmptyRow } from "./cells";

/**
 * 에픽 표의 한 행에 필요한 최소 데이터.
 * `project` 는 목록(에픽 페이지)에서만 쓰고, 프로젝트 상세의 하위 목록에서는
 * `hideProject` 로 숨기므로 optional 이다.
 */
export type EpicTableRow = {
  id: string;
  number: number;
  title: string;
  priority: Priority;
  status: Status;
  team: { key: string } | null;
  owner: MiniUser | null;
  project?: { title: string } | null;
  _count: { tasks: number };
  md: { estimated: number; actual: number };
};

/**
 * 에픽 목록/하위목록 공용 표.
 * 컬럼: [키] [제목] [프로젝트?] [우선순위] [담당자] [태스크] [MD] [상태]
 * - 목록: 전체 컬럼. 프로젝트 상세: `hideProject` 로 프로젝트 컬럼 숨김.
 */
export function EpicsTable({
  epics,
  hideProject = false,
  emptyMessage = "에픽이 없습니다.",
}: {
  epics: EpicTableRow[];
  hideProject?: boolean;
  emptyMessage?: string;
}) {
  const colSpan = hideProject ? 7 : 8;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">키</TableHead>
          <TableHead>제목</TableHead>
          {!hideProject && <TableHead className="w-40">프로젝트</TableHead>}
          <TableHead className="w-20">우선순위</TableHead>
          <TableHead className="w-24">담당자</TableHead>
          <TableHead className="w-16 text-right">태스크</TableHead>
          <TableHead className="w-36 text-right">MD</TableHead>
          <TableHead className="w-24">상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {epics.length === 0 ? (
          <EmptyRow colSpan={colSpan} message={emptyMessage} />
        ) : (
          epics.map((e) => (
            <TableRowLink key={e.id} href={`/epics/${e.id}`}>
              <KeyCell teamKey={e.team?.key} number={e.number} />
              <TableCell className="font-medium">{e.title}</TableCell>
              {!hideProject && (
                <TableCell className="text-muted-foreground truncate text-xs">
                  {e.project?.title ?? "—"}
                </TableCell>
              )}
              <TableCell>
                <PriorityBadge priority={e.priority} />
              </TableCell>
              <TableCell>
                <UserBadge user={e.owner} hideName />
              </TableCell>
              <CountCell value={e._count.tasks} />
              <MdCell estimated={e.md.estimated} actual={e.md.actual} />
              <TableCell>
                <StatusBadge status={e.status} />
              </TableCell>
            </TableRowLink>
          ))
        )}
      </TableBody>
    </Table>
  );
}
