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
import { deleteTask } from "@/server/actions/tasks";
import {
  StatusBadge,
  PriorityBadge,
  LabelBadge,
  BlockedBadge,
} from "@/components/badges";
import { type MiniUser } from "@/components/user-badge";
import { AssigneeBadge } from "@/components/assignee-badge";
import type { TaskEpicOption } from "@/components/forms/task-dialog";
import type { TeamOption } from "@/components/forms/fields";
import {
  InlineTitle,
  InlineStatus,
  InlinePriority,
  InlineNumber,
  InlineDate,
} from "@/components/detail/inline-fields";
import { InlineAssignee } from "@/components/detail/inline-assignee";
import { TaskLabels } from "@/components/detail/task-labels";
import type { LabelItem } from "@/components/detail/entity-labels";
import { OpenDetailKey } from "./open-detail";
import { EmptyRow } from "./cells";
import {
  resolveColumns,
  type ColumnDef,
  type ColumnMeta,
  type ColumnPref,
} from "./column-registry";

/**
 * 태스크 표의 한 행에 필요한 데이터.
 * 편집용 필드(assigneeId 등)는 목록(`edit` 제공)에서 인라인 편집에 쓰며 optional.
 */
export type TaskTableRow = {
  id: string;
  number: number;
  title: string;
  priority: Priority;
  status: Status;
  team: { key: string } | null;
  teamId: string;
  assignee: MiniUser | null;
  assigneeTeam?: TeamOption | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  labels?: { label: { id: string; name: string; color: string } }[];
  assigneeId?: string | null;
  assigneeTeamId?: string | null;
  estimatedMd?: number | null;
  // 미완료 blocker 가 있으면 true(차단됨 배지). 목록 쿼리(getTasks)만 제공, 하위목록은 미제공.
  blocked?: boolean;
};

/** 목록 페이지에서 인라인 편집(담당자 select 등)에 필요한 옵션 목록. */
export type TaskEditContext = {
  members: MiniUser[];
  teams: TeamOption[];
  epics: TaskEpicOption[];
  labels: LabelItem[];
};

const fmt = (d: Date | null | undefined) =>
  d ? format(d, "yyyy.M.d", { locale: ko }) : "—";

/**
 * 태스크 표 컬럼 레지스트리(F4). 각 `cell` 에 기존 인라인 셀 JSX 를 그대로 담는다
 * (`edit ? <Inline/> : <읽기전용/>`). 순서/노출은 columnPref 로 재구성한다.
 * 컬럼: [키] [제목] [담당자] [시작일] [종료일] [우선순위] [상태] [레이블] [MD]
 * - 프로젝트/에픽 표와 동일한 공통 컬럼 순서. 키(식별자)는 맨 앞, MD 는 맨 뒤.
 */
const COLUMNS: ColumnDef<TaskTableRow, TaskEditContext>[] = [
  {
    key: "key",
    label: "키",
    headClassName: "w-28",
    cell: (t) => (
      <TableCell>
        <OpenDetailKey
          href={`/tasks/${t.id}`}
          teamKey={t.team?.key}
          number={t.number}
        />
      </TableCell>
    ),
  },
  {
    key: "title",
    label: "제목",
    cell: (t, edit) => (
      <TableCell className="font-medium">
        <span className="flex flex-wrap items-center gap-1.5">
          {edit ? (
            <InlineTitle
              type="task"
              id={t.id}
              value={t.title}
              href={`/tasks/${t.id}`}
              className="text-sm font-medium"
            />
          ) : (
            <Link href={`/tasks/${t.id}`} className="hover:underline">
              {t.title}
            </Link>
          )}
          {t.blocked && <BlockedBadge />}
        </span>
      </TableCell>
    ),
  },
  {
    key: "assignee",
    label: "담당자",
    headClassName: "w-32",
    cell: (t, edit) => (
      <TableCell>
        {edit ? (
          <InlineAssignee
            taskId={t.id}
            user={t.assignee}
            team={t.assigneeTeam ?? null}
            members={edit.members}
            teams={edit.teams}
            avatarOnly
          />
        ) : (
          <AssigneeBadge
            user={t.assignee}
            team={t.assigneeTeam ?? null}
            hideName
          />
        )}
      </TableCell>
    ),
  },
  {
    key: "startDate",
    label: "시작일",
    headClassName: "w-28",
    cell: (t, edit) => (
      <TableCell className="text-muted-foreground text-xs">
        {edit ? (
          <InlineDate
            type="task"
            id={t.id}
            field="startDate"
            value={t.startDate ?? null}
          />
        ) : (
          fmt(t.startDate)
        )}
      </TableCell>
    ),
  },
  {
    key: "dueDate",
    label: "종료일",
    headClassName: "w-28",
    cell: (t, edit) => (
      <TableCell className="text-muted-foreground text-xs">
        {edit ? (
          <InlineDate
            type="task"
            id={t.id}
            field="dueDate"
            value={t.dueDate ?? null}
          />
        ) : (
          fmt(t.dueDate)
        )}
      </TableCell>
    ),
  },
  {
    key: "priority",
    label: "우선순위",
    headClassName: "w-24",
    cell: (t, edit) => (
      <TableCell>
        {edit ? (
          <InlinePriority type="task" id={t.id} value={t.priority} />
        ) : (
          <PriorityBadge priority={t.priority} />
        )}
      </TableCell>
    ),
  },
  {
    key: "status",
    label: "상태",
    headClassName: "w-28",
    cell: (t, edit) => (
      <TableCell>
        {edit ? (
          <InlineStatus type="task" id={t.id} value={t.status} />
        ) : (
          <StatusBadge status={t.status} />
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
    cell: (t, edit) => (
      <TableCell>
        {edit ? (
          <div className="max-w-40">
            <TaskLabels
              taskId={t.id}
              labels={t.labels?.map((l) => l.label) ?? []}
              allLabels={edit.labels}
              align="start"
              layout="row"
            />
          </div>
        ) : (
          <span className="flex max-w-40 flex-wrap items-center gap-1">
            {t.labels?.length
              ? t.labels.map((l) => (
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
    key: "md",
    label: "MD",
    headClassName: "w-20",
    cell: (t, edit) => (
      <TableCell>
        {edit ? (
          <InlineNumber
            type="task"
            id={t.id}
            field="estimatedMd"
            value={t.estimatedMd ?? null}
          />
        ) : (
          <span className="text-muted-foreground text-sm tabular-nums">
            {t.estimatedMd ?? "—"}
          </span>
        )}
      </TableCell>
    ),
  },
];

/** 설정 UI·목록 페이지가 참조하는 기본 순서 컬럼 메타(렌더 함수 제외). */
export const TASKS_COLUMNS_META: ColumnMeta[] = COLUMNS.map((c) => ({
  key: c.key,
  label: c.label,
}));

/**
 * 태스크 목록/하위목록 공용 표.
 * - `edit` 제공(목록): 각 셀 인라인 편집. 미제공(상세 하위목록): 읽기전용 표시.
 * - `columnPref` 제공(목록): 유저별 컬럼 순서·노출 적용. 미제공 → 기본 컬럼 전체.
 * - 키 클릭: 우측 슬라이드 상세(목록 세그먼트 한정), ↗: 새 탭 전체 페이지.
 */
export function TasksTable({
  tasks,
  emptyMessage = "조건에 맞는 태스크가 없습니다.",
  edit,
  columnPref,
}: {
  tasks: TaskTableRow[];
  emptyMessage?: string;
  edit?: TaskEditContext;
  columnPref?: ColumnPref | null;
}) {
  const cols = resolveColumns(COLUMNS, columnPref);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {cols.map((col) => (
            <TableHead key={col.key} className={col.headClassName}>
              {col.head ?? col.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.length === 0 ? (
          <EmptyRow colSpan={cols.length} message={emptyMessage} />
        ) : (
          tasks.map((t) => {
            const cells = cols.map((col) => (
              <Fragment key={col.key}>{col.cell(t, edit)}</Fragment>
            ));
            // 목록(edit): 행 클릭 → 우측 슬라이드 상세(편집 컨트롤·링크·↗ 는 가드로 제외).
            return edit ? (
              <RowContextMenu
                key={t.id}
                href={`/tasks/${t.id}`}
                id={t.id}
                deleteAction={deleteTask}
              >
                {cells}
              </RowContextMenu>
            ) : (
              <TableRow key={t.id}>{cells}</TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
