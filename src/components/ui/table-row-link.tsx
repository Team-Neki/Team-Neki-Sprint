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
