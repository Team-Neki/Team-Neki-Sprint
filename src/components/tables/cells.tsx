import { formatIssueKey } from "@/lib/constants";
import { TableCell, TableRow } from "@/components/ui/table";
import { MdRollupText } from "@/components/detail/md-rollup";

/**
 * 엔티티 표(TasksTable/EpicsTable/…)에서 반복되는 셀 프리미티브.
 * 컬럼 정렬·폭·타이포를 한 곳에서 고정해 4개 표의 표기를 일치시킨다.
 */

/** 이슈 key 셀(팀 접두어 + 번호, mono). tasks·epics 표 공용. */
export function KeyCell({
  teamKey,
  number,
}: {
  teamKey: string | null | undefined;
  number: number;
}) {
  return (
    <TableCell className="text-muted-foreground font-mono text-xs">
      {formatIssueKey(teamKey, number)}
    </TableCell>
  );
}

/** 우측정렬 카운트 셀(tabular-nums). 하위 항목 수(에픽/태스크/프로젝트) 표시. */
export function CountCell({ value }: { value: number }) {
  return (
    <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
      {value}
    </TableCell>
  );
}

/** 우측정렬 MD 롤업 셀(예상/실제 맨데이). projects·epics 표 공용. */
export function MdCell({
  estimated,
  actual,
}: {
  estimated: number;
  actual: number;
}) {
  return (
    <TableCell className="text-right text-xs">
      <MdRollupText estimated={estimated} actual={actual} />
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
