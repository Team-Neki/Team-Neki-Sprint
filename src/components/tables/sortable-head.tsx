"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

/**
 * URL(`?sort=<field>&dir=asc|desc`) 기반 정렬 헤더. 클릭 시 방향 토글(같은 필드면
 * asc↔desc, 다른 필드면 desc 부터). 기존 쿼리(필터 등)는 보존한다. 서버 컴포넌트 표에서
 * 쓰도록 client 로 분리(useSearchParams). 실제 정렬은 서버 쿼리(orderBy)가 수행.
 */
export function SortableHead({
  field,
  children,
  className,
}: {
  field: string;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeField = params.get("sort");
  const activeDir = (params.get("dir") as SortDir | null) ?? "desc";
  const active = activeField === field;
  const nextDir: SortDir = active && activeDir === "desc" ? "asc" : "desc";

  const qs = new URLSearchParams(params.toString());
  qs.set("sort", field);
  qs.set("dir", nextDir);

  const Icon = !active ? ChevronsUpDown : activeDir === "asc" ? ChevronUp : ChevronDown;

  return (
    <TableHead className={className}>
      <Link
        href={`${pathname}?${qs.toString()}`}
        scroll={false}
        className={cn(
          "hover:text-foreground inline-flex items-center gap-1 select-none",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {children}
        <Icon className={cn("size-3.5", !active && "opacity-50")} />
      </Link>
    </TableHead>
  );
}
