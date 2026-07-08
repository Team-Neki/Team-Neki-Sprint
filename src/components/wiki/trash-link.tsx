"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 좌측 사이드바 '콘텐츠' 하위의 휴지통 진입점. 클릭 시 /wiki/trash 로 이동해
 * soft-delete 된 페이지 목록(복원·영구삭제)을 본다. count 는 휴지통 항목 수.
 */
export function TrashLink({ count }: { count: number }) {
  const pathname = usePathname();
  const active = pathname === "/wiki/trash";

  return (
    <Link
      href="/wiki/trash"
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Trash2 className="size-3.5 shrink-0" />
      <span className="flex-1 truncate">휴지통</span>
      {count > 0 && <span className="text-xs tabular-nums">{count}</span>}
    </Link>
  );
}
