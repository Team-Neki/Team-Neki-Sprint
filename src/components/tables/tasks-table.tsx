import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Pencil } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { StatusBadge, PriorityBadge, LabelBadge } from "@/components/badges";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import {
  TaskDialog,
  type TaskEpicOption,
} from "@/components/forms/task-dialog";
import type { TeamOption } from "@/components/forms/fields";
import { RowActionCell } from "./row-action-cell";
import { KeyCell, EmptyRow } from "./cells";

/**
 * 태스크 표의 한 행에 필요한 데이터.
 * `epic` 은 목록(태스크 페이지)에서만 쓰고, 에픽 상세의 하위 목록에서는
 * `hideEpic` 로 숨기므로 optional 이다. 편집용 필드(description·assigneeId·epicId·
 * 날짜·포인트·MD)는 다이얼로그를 열 때만 쓰며 optional; teamId 는 항상 있어 required.
 */
export type TaskTableRow = {
  id: string;
  number: number;
  title: string;
  priority: Priority;
  status: Status;
  dueDate: Date | null;
  team: { key: string } | null;
  teamId: string;
  assignee: MiniUser | null;
  epic?: { title: string } | null;
  labels?: { label: { id: string; name: string; color: string } }[];
  description?: string | null;
  assigneeId?: string | null;
  epicId?: string | null;
  startDate?: Date | null;
  storyPoints?: number | null;
  estimatedMd?: number | null;
  actualMd?: number | null;
};

/** 목록 페이지에서 행별 수정 다이얼로그를 열기 위한 옵션 목록. */
export type TaskEditContext = {
  members: MiniUser[];
  teams: TeamOption[];
  epics: TaskEpicOption[];
};

/**
 * 태스크 목록/하위목록 공용 표.
 * 컬럼: [키] [제목] [에픽?] [우선순위] [담당자] [마감] [상태] [수정?]
 * - 목록: 전체 컬럼 + `edit` 시 행별 수정. 에픽 상세: `hideEpic`(맥락 중복 제거).
 */
export function TasksTable({
  tasks,
  hideEpic = false,
  emptyMessage = "조건에 맞는 태스크가 없습니다.",
  edit,
}: {
  tasks: TaskTableRow[];
  hideEpic?: boolean;
  emptyMessage?: string;
  edit?: TaskEditContext;
}) {
  const colSpan = (hideEpic ? 6 : 7) + (edit ? 1 : 0);
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
          {edit && (
            <TableHead className="w-10">
              <span className="sr-only">수정</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.length === 0 ? (
          <EmptyRow colSpan={colSpan} message={emptyMessage} />
        ) : (
          tasks.map((t) => (
            <TableRowLink key={t.id} href={`/tasks/${t.id}`}>
              <KeyCell teamKey={t.team?.key} number={t.number} />
              <TableCell className="font-medium">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span>{t.title}</span>
                  {t.labels?.map((l) => (
                    <LabelBadge
                      key={l.label.id}
                      name={l.label.name}
                      color={l.label.color}
                    />
                  ))}
                </span>
              </TableCell>
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
              {edit && (
                <RowActionCell>
                  <TaskDialog
                    members={edit.members}
                    teams={edit.teams}
                    epics={edit.epics}
                    task={{
                      id: t.id,
                      title: t.title,
                      description: t.description ?? null,
                      status: t.status,
                      priority: t.priority,
                      assigneeId: t.assigneeId ?? null,
                      teamId: t.teamId,
                      epicId: t.epicId ?? null,
                      startDate: t.startDate ?? null,
                      dueDate: t.dueDate,
                      storyPoints: t.storyPoints ?? null,
                      estimatedMd: t.estimatedMd ?? null,
                      actualMd: t.actualMd ?? null,
                    }}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="수정"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                </RowActionCell>
              )}
            </TableRowLink>
          ))
        )}
      </TableBody>
    </Table>
  );
}
