import { format } from "date-fns";
import { ko } from "date-fns/locale";
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
import { KeyCell, EmptyRow } from "./cells";

/**
 * 태스크 표의 한 행에 필요한 최소 데이터.
 * `epic` 은 목록(태스크 페이지)에서만 쓰고, 에픽 상세의 하위 목록에서는
 * `hideEpic` 로 숨기므로 optional 이다.
 */
export type TaskTableRow = {
  id: string;
  number: number;
  title: string;
  priority: Priority;
  status: Status;
  dueDate: Date | null;
  team: { key: string } | null;
  assignee: MiniUser | null;
  epic?: { title: string } | null;
};

/**
 * 태스크 목록/하위목록 공용 표.
 * 컬럼: [키] [제목] [에픽?] [우선순위] [담당자] [마감] [상태]
 * - 목록: 전체 컬럼. 에픽 상세: `hideEpic` 로 에픽 컬럼 숨김(맥락 중복 제거).
 */
export function TasksTable({
  tasks,
  hideEpic = false,
  emptyMessage = "조건에 맞는 태스크가 없습니다.",
}: {
  tasks: TaskTableRow[];
  hideEpic?: boolean;
  emptyMessage?: string;
}) {
  const colSpan = hideEpic ? 6 : 7;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">키</TableHead>
          <TableHead>제목</TableHead>
          {!hideEpic && <TableHead className="w-40">에픽</TableHead>}
          <TableHead className="w-20">우선순위</TableHead>
          <TableHead className="w-28">담당자</TableHead>
          <TableHead className="w-24">마감</TableHead>
          <TableHead className="w-24">상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.length === 0 ? (
          <EmptyRow colSpan={colSpan} message={emptyMessage} />
        ) : (
          tasks.map((t) => (
            <TableRowLink key={t.id} href={`/tasks/${t.id}`}>
              <KeyCell teamKey={t.team?.key} number={t.number} />
              <TableCell className="font-medium">{t.title}</TableCell>
              {!hideEpic && (
                <TableCell className="text-muted-foreground truncate text-xs">
                  {t.epic?.title ?? "—"}
                </TableCell>
              )}
              <TableCell>
                <PriorityBadge priority={t.priority} />
              </TableCell>
              <TableCell>
                <UserBadge user={t.assignee} hideName />
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {t.dueDate
                  ? format(t.dueDate, "yyyy.M.d", { locale: ko })
                  : "—"}
              </TableCell>
              <TableCell>
                <StatusBadge status={t.status} />
              </TableCell>
            </TableRowLink>
          ))
        )}
      </TableBody>
    </Table>
  );
}
