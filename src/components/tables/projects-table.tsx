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
import { ProjectDialog } from "@/components/forms/project-dialog";
import { RowActionCell } from "./row-action-cell";
import { MdCell, EmptyRow } from "./cells";

/**
 * 프로젝트 표의 한 행에 필요한 데이터.
 * 프로젝트는 이슈 key 가 없다(팀 접두어 미부여). `sprint` 는 목록에서만 쓰고
 * 스프린트 상세의 하위 목록에서는 `hideSprint` 로 숨기므로 optional 이다.
 * 편집용 필드(description·ownerId·sprintId·날짜)는 목록 페이지 쿼리(include)엔 있지만
 * 상세 하위목록엔 없을 수 있어 optional — 편집 다이얼로그를 열 때만 사용한다.
 */
export type ProjectTableRow = {
  id: string;
  title: string;
  priority: Priority;
  status: Status;
  owner: MiniUser | null;
  sprint?: { name: string } | null;
  md: { estimated: number; actual: number };
  description?: string | null;
  ownerId?: string | null;
  sprintId?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
};

/** 목록 페이지에서 행별 수정 다이얼로그를 열기 위한 옵션 목록. */
export type ProjectEditContext = {
  members: MiniUser[];
  sprints: { id: string; name: string }[];
};

/**
 * 프로젝트 목록/하위목록 공용 표.
 * 컬럼: [제목] [스프린트?] [우선순위] [담당자] [MD] [상태] [수정?]
 * - 목록: 전체 컬럼 + `edit` 시 행별 수정. 스프린트 상세: `hideSprint`.
 */
export function ProjectsTable({
  projects,
  hideSprint = false,
  emptyMessage = "프로젝트가 없습니다.",
  edit,
}: {
  projects: ProjectTableRow[];
  hideSprint?: boolean;
  emptyMessage?: string;
  edit?: ProjectEditContext;
}) {
  const colSpan = (hideSprint ? 5 : 6) + (edit ? 1 : 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>제목</TableHead>
          {!hideSprint && <TableHead className="w-40">스프린트</TableHead>}
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
              <MdCell estimated={p.md.estimated} actual={p.md.actual} />
              <TableCell>
                <StatusBadge status={p.status} />
              </TableCell>
              {edit && (
                <RowActionCell>
                  <ProjectDialog
                    members={edit.members}
                    sprints={edit.sprints}
                    project={{
                      id: p.id,
                      title: p.title,
                      description: p.description ?? null,
                      status: p.status,
                      priority: p.priority,
                      ownerId: p.ownerId ?? null,
                      sprintId: p.sprintId ?? null,
                      startDate: p.startDate ?? null,
                      dueDate: p.dueDate ?? null,
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
