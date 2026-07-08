import type { Priority, Status } from "@prisma/client";
import { Pencil } from "lucide-react";
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
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { EpicDialog } from "@/components/forms/epic-dialog";
import type { TeamOption } from "@/components/forms/fields";
import { RowActionCell } from "./row-action-cell";
import { KeyCell, MdCell, EmptyRow } from "./cells";

/**
 * 에픽 표의 한 행에 필요한 데이터.
 * `project` 는 목록(에픽 페이지)에서만 쓰고, 프로젝트 상세의 하위 목록에서는
 * `hideProject` 로 숨기므로 optional 이다. 편집용 필드(description·ownerId·projectId·
 * 날짜)는 다이얼로그를 열 때만 쓰며 optional; teamId 는 스키마상 항상 있으므로 required.
 */
export type EpicTableRow = {
  id: string;
  number: number;
  title: string;
  priority: Priority;
  status: Status;
  team: { key: string } | null;
  teamId: string;
  owner: MiniUser | null;
  project?: { title: string } | null;
  md: { estimated: number; actual: number };
  description?: string | null;
  ownerId?: string | null;
  projectId?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
};

/** 목록 페이지에서 행별 수정 다이얼로그를 열기 위한 옵션 목록. */
export type EpicEditContext = {
  members: MiniUser[];
  teams: TeamOption[];
  projects: { id: string; title: string }[];
};

/**
 * 에픽 목록/하위목록 공용 표.
 * 컬럼: [키] [제목] [프로젝트?] [우선순위] [담당자] [MD] [상태] [수정?]
 * - 목록: 전체 컬럼 + `edit` 시 행별 수정. 프로젝트 상세: `hideProject`.
 */
export function EpicsTable({
  epics,
  hideProject = false,
  emptyMessage = "에픽이 없습니다.",
  edit,
}: {
  epics: EpicTableRow[];
  hideProject?: boolean;
  emptyMessage?: string;
  edit?: EpicEditContext;
}) {
  const colSpan = (hideProject ? 6 : 7) + (edit ? 1 : 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">키</TableHead>
          <TableHead>제목</TableHead>
          {!hideProject && <TableHead className="w-40">프로젝트</TableHead>}
          <TableHead className="w-20">우선순위</TableHead>
          <TableHead className="w-24">담당자</TableHead>
          <TableHead className="w-36 text-right">MD</TableHead>
          <TableHead className="w-24">상태</TableHead>
          {edit && (
            <TableHead className="w-10">
              <span className="sr-only">수정</span>
            </TableHead>
          )}
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
              <MdCell estimated={e.md.estimated} actual={e.md.actual} />
              <TableCell>
                <StatusBadge status={e.status} />
              </TableCell>
              {edit && (
                <RowActionCell>
                  <EpicDialog
                    members={edit.members}
                    teams={edit.teams}
                    projects={edit.projects}
                    epic={{
                      id: e.id,
                      title: e.title,
                      description: e.description ?? null,
                      status: e.status,
                      priority: e.priority,
                      ownerId: e.ownerId ?? null,
                      teamId: e.teamId,
                      projectId: e.projectId ?? null,
                      startDate: e.startDate ?? null,
                      dueDate: e.dueDate ?? null,
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
