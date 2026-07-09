import { TableCell, TableRow } from "@/components/ui/table";

/**
 * 엔티티 표(SprintsTable 등)에서 반복되는 셀 프리미티브.
 * 컬럼 정렬·폭·타이포를 한 곳에서 고정해 표기를 일치시킨다.
 */

/** 우측정렬 카운트 셀(tabular-nums). 하위 항목 수(프로젝트 등) 표시. */
export function CountCell({ value }: { value: number }) {
  return (
    <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
      {value}
    </TableCell>
  );
}

/** 행이 없을 때 표시하는 전체폭 안내 행. colSpan 은 표의 노출 컬럼 수에 맞춘다. */
export function EmptyRow({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className="text-muted-foreground py-12 text-center text-sm"
      >
        {message}
      </TableCell>
    </TableRow>
  );
}
