"use client";

import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  useInSheet,
  useSheetChromeSlot,
} from "@/components/detail/in-sheet-context";

/**
 * 상세 페이지 삭제 버튼. 전체 페이지에선 타이틀 행 우측에 인라인(size=sm)으로,
 * 우측 상세 시트 안에선 시트 크롬(DetailSheet)의 삭제 슬롯으로 포털돼 새 창 열기·
 * 닫기 버튼과 한 줄로 정렬된다(우상단 3버튼 겹침 방지). 상세 페이지는 서버 컴포넌트라
 * useInSheet/슬롯 감지를 못 하므로 이 클라이언트 래퍼가 대신 처리한다.
 */
export function SheetDeleteButton({
  onConfirm,
  redirectTo,
  description,
}: {
  onConfirm: () => Promise<void>;
  redirectTo?: string;
  description?: string;
}) {
  const inSheet = useInSheet();
  const slot = useSheetChromeSlot();

  const dialog = (
    <ConfirmDelete
      onConfirm={onConfirm}
      redirectTo={redirectTo}
      description={description}
      trigger={
        <Button
          variant="ghost"
          size={inSheet ? "icon" : "sm"}
          aria-label="삭제"
          className="text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      }
    />
  );

  // 시트 안: 슬롯이 준비되면 크롬으로 포털. 준비 전 한 프레임은 숨겨 겹침을 막는다.
  if (inSheet) return slot ? createPortal(dialog, slot) : null;
  // 전체 페이지: 타이틀 행에 인라인.
  return dialog;
}
