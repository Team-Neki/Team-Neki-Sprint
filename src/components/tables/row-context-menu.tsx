"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PanelRight, ArrowUpRight, Trash2 } from "lucide-react";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ConfirmDelete } from "@/components/confirm-delete";

// 행 클릭이 상세로 이동하면 안 되는 인터랙티브 요소들(인라인 편집·링크·버튼 등).
// table-row-link 의 RowOpenSheet 와 동일 규약 — 이 위 클릭은 행 내비게이션에서 제외.
const INTERACTIVE =
  'a,button,input,textarea,select,label,[role="combobox"],[data-slot="select-trigger"],[contenteditable="true"]';

/**
 * 목록 표의 한 행. 좌클릭(빈 영역)은 소프트 내비게이션으로 상세를 열고, 우클릭은
 * 컨텍스트 메뉴(열기 · 새 창에서 열기 · 삭제)를 띄운다. 삭제는 controlled
 * `ConfirmDelete` 로 확인받은 뒤 `deleteAction(id)` 를 호출한다(성공 시 목록 새로고침).
 *
 * `deleteAction` 은 서버 액션(예: deleteTask)이라 서버 컴포넌트(표)에서 그대로 prop
 * 으로 넘길 수 있다. 행 안 편집 컨트롤 위 좌클릭은 INTERACTIVE 가드로 제외한다.
 */
export function RowContextMenu({
  href,
  id,
  deleteAction,
  deleteDescription,
  className,
  children,
}: {
  href: string;
  id: string;
  deleteAction: (id: string) => Promise<void>;
  deleteDescription?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const open = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    if (e.metaKey || e.ctrlKey) {
      window.open(href, "_blank");
      return;
    }
    router.push(href, { scroll: false });
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <TableRow
              className={cn("cursor-pointer", className)}
              onClick={open}
            />
          }
        >
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={() => router.push(href, { scroll: false })}
          >
            <PanelRight className="size-4" /> 열기
          </ContextMenuItem>
          <ContextMenuItem onClick={() => window.open(href, "_blank")}>
            <ArrowUpRight className="size-4" /> 새 창에서 열기
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" /> 삭제
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <ConfirmDelete
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => deleteAction(id)}
        description={deleteDescription}
      />
    </>
  );
}
