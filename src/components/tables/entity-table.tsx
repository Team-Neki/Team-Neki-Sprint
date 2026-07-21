import { Fragment } from "react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RowContextMenu } from "./row-context-menu";
import { SortableHead } from "./sortable-head";
import { EmptyRow } from "./cells";
import {
  resolveColumns,
  type ColumnDef,
  type ColumnPref,
} from "./column-registry";

/**
 * 엔티티 목록 공용 표 셸. 컬럼 정의는 호출부가 주입한다(`*-columns.tsx`).
 * 4개 엔티티 표(task/epic/project/sprint)가 이 하나의 셸을 공유하므로,
 * 표 공통 동작(정렬 헤더·행 메뉴·빈 안내·컬럼 pref)은 여기 한 곳만 고치면 된다.
 *
 * - `edit` 제공: 셀 렌더러가 인라인 편집 컨트롤을 그린다. 미제공: 읽기전용 표시.
 * - `deleteAction` 제공: 행을 `RowContextMenu`(좌클릭 상세 이동 + 우클릭 열기/새 창/삭제)로
 *   감싼다. 미제공: 일반 정적 행. 삭제 확인 문구는 `deleteDescription`.
 * - `sortable` 제공: `sortField` 있는 컬럼 헤더를 `SortableHead`(URL `?sort=&dir=`)로 렌더.
 *   하위목록처럼 URL 정렬이 안 먹는 곳에선 주지 않는다.
 * - `columnPref` 제공: 유저별 컬럼 순서·노출 적용. 미제공 → 기본 컬럼 전체.
 */
export function EntityTable<Row extends { id: string }, Edit>({
  rows,
  columns,
  rowHref,
  emptyMessage,
  edit,
  sortable,
  columnPref,
  deleteAction,
  deleteDescription,
}: {
  rows: Row[];
  columns: ColumnDef<Row, Edit>[];
  rowHref: (row: Row) => string;
  emptyMessage: string;
  edit?: Edit;
  sortable?: boolean;
  columnPref?: ColumnPref | null;
  deleteAction?: (id: string) => Promise<void>;
  deleteDescription?: string;
}) {
  const cols = resolveColumns(columns, columnPref);
  return (
    <Table>
      <TableHeader>
        <TableRow>
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
        {rows.length === 0 ? (
          <EmptyRow colSpan={cols.length} message={emptyMessage} />
        ) : (
          rows.map((row) => {
            const cells = cols.map((col) => (
              <Fragment key={col.key}>{col.cell(row, edit)}</Fragment>
            ));
            return deleteAction ? (
              <RowContextMenu
                key={row.id}
                href={rowHref(row)}
                id={row.id}
                deleteAction={deleteAction}
                deleteDescription={deleteDescription}
              >
                {cells}
              </RowContextMenu>
            ) : (
              <TableRow key={row.id}>{cells}</TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
