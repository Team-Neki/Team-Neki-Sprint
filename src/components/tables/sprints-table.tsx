import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { SprintStatus } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableRowLink } from "@/components/ui/table-row-link";
import { SprintStatusBadge } from "@/components/badges";
import { CountCell, EmptyRow } from "./cells";

/** 스프린트 표의 한 행에 필요한 최소 데이터. */
export type SprintTableRow = {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  status: SprintStatus;
  _count: { projects: number };
};

function dateRange(start: Date | null, end: Date | null) {
  const fmt = (d: Date) => format(d, "yyyy.M.d", { locale: ko });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `${fmt(start)} –`;
  if (end) return `– ${fmt(end)}`;
  return "기간 미설정";
}

/**
 * 스프린트 목록 표.
 * 컬럼: [이름] [기간] [프로젝트] [상태]
 */
export function SprintsTable({
  sprints,
  emptyMessage = "스프린트가 없습니다.",
}: {
  sprints: SprintTableRow[];
  emptyMessage?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead className="w-56">기간</TableHead>
          <TableHead className="w-24 text-right">프로젝트</TableHead>
          <TableHead className="w-24">상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sprints.length === 0 ? (
          <EmptyRow colSpan={4} message={emptyMessage} />
        ) : (
          sprints.map((s) => (
            <TableRowLink key={s.id} href={`/sprints/${s.id}`}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {dateRange(s.startDate, s.endDate)}
              </TableCell>
              <CountCell value={s._count.projects} />
              <TableCell>
                <SprintStatusBadge status={s.status} />
              </TableCell>
            </TableRowLink>
          ))
        )}
      </TableBody>
    </Table>
  );
}
