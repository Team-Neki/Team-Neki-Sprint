"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * 행 전체가 클릭 가능한 <TableRow>. 목록 표에서 셀 일부(키/제목)만이 아니라
 * 행 어디를 눌러도 상세로 이동한다(#1 클릭 영역 확장 + 전체 행 클릭).
 *
 * 셀 내용은 순수 표시용(링크/버튼 없음)이라 stopPropagation 없이 동작한다.
 * - cmd/ctrl+클릭: 새 탭으로 열기(앵커의 기본 UX 보존)
 * - hover 시 prefetch, Enter 키로 이동(키보드 접근성 role=link/tabIndex)
 */
export function TableRowLink({
  href,
  className,
  children,
  ...props
}: React.ComponentProps<typeof TableRow> & { href: string }) {
  const router = useRouter();
  return (
    <TableRow
      role="link"
      tabIndex={0}
      className={cn("cursor-pointer", className)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
        else router.push(href);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
      onMouseEnter={() => router.prefetch(href)}
      {...props}
    >
      {children}
    </TableRow>
  );
}

// 행 클릭이 상세로 이동하면 안 되는 인터랙티브 요소들(인라인 편집·링크·버튼 등).
// 이들 위 클릭은 행 내비게이션에서 제외한다(편집/선택이 그대로 동작).
const INTERACTIVE =
  'a,button,input,textarea,select,label,[role="combobox"],[data-slot="select-trigger"],[contenteditable="true"]';

/**
 * 인라인 편집 컨트롤이 있는 목록 행용 클릭-투-오픈. 행의 빈 영역을 누르면 소프트
 * 내비게이션(scroll:false)으로 우측 슬라이드 상세(intercepting route)를 연다. 셀 안의
 * 편집 컨트롤(select·input·버튼·링크) 위 클릭은 가드해 행 이동을 막는다. 새 탭은
 * 각 행의 ↗ 버튼(하드 로드)으로만 연다(여기선 cmd/ctrl+클릭만 예외 허용).
 */
export function RowOpenSheet({
  href,
  className,
  children,
  ...props
}: React.ComponentProps<typeof TableRow> & { href: string }) {
  const router = useRouter();
  const open = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
    if ("metaKey" in e && (e.metaKey || e.ctrlKey)) {
      window.open(href, "_blank");
      return;
    }
    router.push(href, { scroll: false });
  };
  return (
    <TableRow
      className={cn("cursor-pointer", className)}
      onClick={open}
      {...props}
    >
      {children}
    </TableRow>
  );
}
