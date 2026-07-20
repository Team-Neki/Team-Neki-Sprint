import { Fragment } from "react";
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
import { RowContextMenu } from "@/components/tables/row-context-menu";
import { deleteSprint } from "@/server/actions/sprints";
import { SprintStatusBadge } from "@/components/badges";
import { EmptyRow } from "./cells";
import {
  resolveColumns,
  type ColumnDef,
  type ColumnMeta,
  type ColumnPref,
} from "./column-registry";

/** 스프린트 표의 한 행에 필요한 최소 데이터. */
export type SprintTableRow = {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  status: SprintStatus;
  /** 스프린트에 속한 전체 태스크의 예상 MD 합(하위 프로젝트→에픽→태스크 롤업). */
  estimatedMd: number;
};

const fmt = (d: Date | null) =>
  d ? format(d, "yyyy.M.d", { locale: ko }) : "—";

/**
 * 스프린트 표 컬럼 레지스트리(F4). 각 `cell` 에 기존 셀 JSX 를 그대로 담는다.
 * 컬럼: [이름] [시작일] [종료일] [MD] [상태]
 * (기간 단일 컬럼을 시작일·종료일로 분리 — 다른 표와 동일한 날짜 표기.)
 */
const COLUMNS: ColumnDef<SprintTableRow, never>[] = [
  {
    key: "name",
    label: "이름",
    cell: (s) => <TableCell className="font-medium">{s.name}</TableCell>,
  },
  {
    key: "startDate",
    label: "시작일",
    headClassName: "w-28",
    cell: (s) => (
      <TableCell className="text-muted-foreground text-xs">
        {fmt(s.startDate)}
      </TableCell>
    ),
  },
  {
    key: "endDate",
    label: "종료일",
    headClassName: "w-28",
    cell: (s) => (
      <TableCell className="text-muted-foreground text-xs">
        {fmt(s.endDate)}
      </TableCell>
    ),
  },
  {
    key: "md",
    label: "MD",
    headClassName: "w-24 text-right",
    cell: (s) => (
      <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
        {s.estimatedMd || "—"}
      </TableCell>
    ),
  },
  {
    key: "status",
    label: "상태",
    headClassName: "w-24",
    cell: (s) => (
      <TableCell>
        <SprintStatusBadge status={s.status} />
      </TableCell>
    ),
  },
];

/** 설정 UI·목록 페이지가 참조하는 기본 순서 컬럼 메타(렌더 함수 제외). */
export const SPRINTS_COLUMNS_META: ColumnMeta[] = COLUMNS.map((c) => ({
  key: c.key,
  label: c.label,
}));

/**
 * 스프린트 목록 표.
 * - `columnPref` 제공(목록): 유저별 컬럼 순서·노출 적용. 미제공 → 기본 컬럼 전체.
 */
export function SprintsTable({
  sprints,
  emptyMessage = "스프린트가 없습니다.",
  columnPref,
}: {
  sprints: SprintTableRow[];
  emptyMessage?: string;
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
        {sprints.length === 0 ? (
          <EmptyRow colSpan={cols.length} message={emptyMessage} />
        ) : (
          sprints.map((s) => (
            <RowContextMenu
              key={s.id}
              href={`/sprints/${s.id}`}
              id={s.id}
              deleteAction={deleteSprint}
              deleteDescription="스프린트가 삭제됩니다. 하위 프로젝트는 삭제되지 않고 스프린트 연결만 해제됩니다."
            >
              {cols.map((col) => (
                <Fragment key={col.key}>{col.cell(s)}</Fragment>
              ))}
            </RowContextMenu>
          ))
        )}
      </TableBody>
    </Table>
  );
}
