"use client";

import { TableCell } from "@/components/ui/table";

/**
 * 목록 표의 행별 '수정' 액션 셀. 행 전체가 링크(TableRowLink)이므로, 이 셀 안의
 * 클릭(수정 버튼·다이얼로그 트리거)이 행 이동으로 전파되지 않게 stopPropagation 한다.
 * 서버 컴포넌트인 표에서 onClick 을 직접 못 다루므로 이 client 래퍼로 분리한다.
 */
export function RowActionCell({ children }: { children: React.ReactNode }) {
  return (
    <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
      {children}
    </TableCell>
  );
}
