import { Fragment } from "react";
import Link from "next/link";
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
import { RowContextMenu } from "@/components/tables/row-context-menu";
import { deleteProject } from "@/server/actions/projects";
import { StatusBadge, PriorityBadge, LabelBadge } from "@/components/badges";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import {
  InlineTitle,
  InlineStatus,
  InlinePriority,
  InlineMember,
  InlineDate,
} from "@/components/detail/inline-fields";
import { ProjectLabels } from "@/components/detail/project-labels";
import type { LabelItem } from "@/components/detail/entity-labels";
import { OpenDetailIcon } from "./open-detail";
import { SortableHead } from "./sortable-head";
import { EmptyRow } from "./cells";
import {
  resolveColumns,
  type ColumnDef,
  type ColumnMeta,
  type ColumnPref,
} from "./column-registry";

/**
 * 프로젝트 표의 한 행에 필요한 데이터. 프로젝트는 이슈 key 가 없다(팀 접두어 미부여).
 * 레이블은 표시 전용(프로젝트 라벨 부여 UI 는 미구현 — 후속).
 */
export type ProjectTableRow = {
  id: string;
  title: string;
  priority: Priority;
  status: Status;
  owner: MiniUser | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  labels?: { label: { id: string; name: string; color: string } }[];
  ownerId?: string | null;
};

/** 목록 페이지에서 인라인 편집에 필요한 옵션 목록. */
export type ProjectEditContext = {
  members: MiniUser[];
  sprints: { id: string; name: string }[];
  labels: LabelItem[];
};

const fmt = (d: Date | null | undefined) =>
  d ? format(d, "yyyy.M.d", { locale: ko }) : "—";

/**
 * 프로젝트 표 컬럼 레지스트리(F4). 각 `cell` 에 기존 인라인 셀 JSX 를 그대로 담는다.
 * 컬럼: [제목] [담당자] [시작일] [종료일] [우선순위] [상태] [레이블] [열기]
 * - `sortField` + 표 `sortable` 이면 헤더를 SortableHead 로 렌더(title/dueDate/priority/status).
 * - 시작일=startDate, 종료일=dueDate. (생성/수정시간 컬럼은 노출하지 않는다.)
 */
const COLUMNS: ColumnDef<ProjectTableRow, ProjectEditContext>[] = [
  {
    key: "title",
    label: "제목",
    sortField: "title",
    cell: (p, edit) => (
      <TableCell className="font-medium">
        {edit ? (
          <InlineTitle
            type="project"
            id={p.id}
            value={p.title}
            href={`/projects/${p.id}`}
            className="text-sm font-medium"
          />
        ) : (
          <Link href={`/projects/${p.id}`} className="hover:underline">
            {p.title}
          </Link>
        )}
      </TableCell>
    ),
  },
  {
    key: "assignee",
    label: "담당자",
    headClassName: "w-32",
    cell: (p, edit) => (
      <TableCell>
        {edit ? (
          <InlineMember
            type="project"
            id={p.id}
            field="ownerId"
            value={p.owner}
            members={edit.members}
            avatarOnly
          />
        ) : (
          <UserBadge user={p.owner} hideName />
        )}
      </TableCell>
    ),
  },
  {
    key: "startDate",
    label: "시작일",
    headClassName: "w-28",
    cell: (p, edit) => (
      <TableCell className="text-muted-foreground text-xs">
        {edit ? (
          <InlineDate
            type="project"
            id={p.id}
            field="startDate"
            value={p.startDate ?? null}
          />
        ) : (
          fmt(p.startDate)
        )}
      </TableCell>
    ),
  },
  {
    key: "dueDate",
    label: "종료일",
    headClassName: "w-28",
    sortField: "dueDate",
    cell: (p, edit) => (
      <TableCell className="text-muted-foreground text-xs">
        {edit ? (
          <InlineDate
            type="project"
            id={p.id}
            field="dueDate"
            value={p.dueDate ?? null}
          />
        ) : (
          fmt(p.dueDate)
        )}
      </TableCell>
    ),
  },
  {
    key: "priority",
    label: "우선순위",
    headClassName: "w-24",
    sortField: "priority",
    cell: (p, edit) => (
      <TableCell>
        {edit ? (
          <InlinePriority type="project" id={p.id} value={p.priority} />
        ) : (
          <PriorityBadge priority={p.priority} />
        )}
      </TableCell>
    ),
  },
  {
    key: "status",
    label: "상태",
    headClassName: "w-28",
    sortField: "status",
    cell: (p, edit) => (
      <TableCell>
        {edit ? (
          <InlineStatus type="project" id={p.id} value={p.status} />
        ) : (
          <StatusBadge status={p.status} />
        )}
      </TableCell>
    ),
  },
  {
    key: "labels",
    label: "레이블",
    headClassName: "w-40",
    // 라벨 셀: auto-layout 표에서 컬럼이 밀리지 않도록 폭을 헤더(w-40)에
    // 맞춰 상한 두고 넘치면 줄바꿈(가로 blowout 방지).
    cell: (p, edit) => (
      <TableCell>
        {edit ? (
          <div className="max-w-40">
            <ProjectLabels
              projectId={p.id}
              labels={p.labels?.map((l) => l.label) ?? []}
              allLabels={edit.labels}
              align="start"
            />
          </div>
        ) : (
          <span className="flex max-w-40 flex-wrap items-center gap-1">
            {p.labels?.length
              ? p.labels.map((l) => (
                  <LabelBadge
                    key={l.label.id}
                    name={l.label.name}
                    color={l.label.color}
                  />
                ))
              : "—"}
          </span>
        )}
      </TableCell>
    ),
  },
  {
    key: "open",
    label: "열기",
    headClassName: "w-16",
    head: <span className="sr-only">열기</span>,
    cell: (p) => (
      <TableCell>
        <OpenDetailIcon href={`/projects/${p.id}`} />
      </TableCell>
    ),
  },
];

/** 설정 UI·목록 페이지가 참조하는 기본 순서 컬럼 메타(렌더 함수 제외). */
export const PROJECTS_COLUMNS_META: ColumnMeta[] = COLUMNS.map((c) => ({
  key: c.key,
  label: c.label,
}));

/**
 * 프로젝트 목록/하위목록 공용 표.
 * - `edit` 제공(목록): 제목·담당자·시작일·종료일·우선순위·상태 인라인 편집. 레이블은 읽기전용.
 * - `sortable` 제공(목록): 정렬 가능 컬럼 헤더를 SortableHead 로 렌더(하위목록은 URL 정렬 미지원).
 * - `columnPref` 제공(목록): 유저별 컬럼 순서·노출 적용. 미제공 → 기본 컬럼 전체.
 * - 열기 셀: 패널 아이콘 클릭 = 우측 슬라이드 상세, 새 창 열기 = 새 탭 전체 페이지.
 */
export function ProjectsTable({
  projects,
  emptyMessage = "프로젝트가 없습니다.",
  edit,
  sortable,
  columnPref,
}: {
  projects: ProjectTableRow[];
  emptyMessage?: string;
  edit?: ProjectEditContext;
  sortable?: boolean;
  columnPref?: ColumnPref | null;
}) {
  const cols = resolveColumns(COLUMNS, columnPref);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {/* 정렬 헤더는 목록(sortable)에서만 — 하위목록에선 URL 정렬이 안 먹으므로 일반 헤더. */}
          {cols.map((col) =>
            sortable && col.sortField ? (
              <SortableHead
                key={col.key}
                field={col.sortField}
                className={col.headClassName}
              >
                {col.label}
              </SortableHead>
            ) : (
              <TableHead key={col.key} className={col.headClassName}>
                {col.head ?? col.label}
              </TableHead>
            ),
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.length === 0 ? (
          <EmptyRow colSpan={cols.length} message={emptyMessage} />
        ) : (
          projects.map((p) => {
            const cells = cols.map((col) => (
              <Fragment key={col.key}>{col.cell(p, edit)}</Fragment>
            ));
            return edit ? (
              <RowContextMenu
                key={p.id}
                href={`/projects/${p.id}`}
                id={p.id}
                deleteAction={deleteProject}
                deleteDescription="프로젝트가 삭제됩니다. 하위 에픽은 삭제되지 않고 프로젝트 연결만 해제됩니다."
              >
                {cells}
              </RowContextMenu>
            ) : (
              <TableRow key={p.id}>{cells}</TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
