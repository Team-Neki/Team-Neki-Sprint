import Link from "next/link";
import type { Status, Priority } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { cn } from "@/lib/utils";

/**
 * 이니셔티브·에픽 목록의 공용 행(row).
 * 고정 뼈대(키 · 제목 · 우선순위 · 담당자 · 상태)를 공유하고,
 * 항목별로 다른 보조 정보(상위 항목/카운트/마감일)는 `meta` 슬롯으로 받는다.
 * 컬럼 순서: [키] [제목(flex-1)] [우선순위] [meta] [담당자] [상태]
 */
export function ItemRow({
  href,
  itemKey,
  title,
  priority,
  status,
  owner,
  meta,
}: {
  href: string;
  itemKey: string;
  title: string;
  priority: Priority;
  status: Status;
  owner: MiniUser | null | undefined;
  meta?: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/40 flex flex-row items-center gap-4 px-4 py-3 transition-colors">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="text-muted-foreground w-20 shrink-0 font-mono text-xs">
            {itemKey}
          </span>
          <span className="truncate font-medium">{title}</span>
        </div>
        <PriorityBadge priority={priority} />
        {meta}
        <UserBadge user={owner} hideName />
        <StatusBadge status={status} />
      </Card>
    </Link>
  );
}

/**
 * ItemRow의 meta 슬롯에 넣는 보조 정보 셀. 기본값은 데스크톱에서만 노출(hidden).
 * 노출 폭·시점은 className으로 지정(예: "w-20 sm:block", "max-w-40 truncate md:block").
 */
export function RowMeta({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("text-muted-foreground hidden text-xs", className)}>
      {children}
    </span>
  );
}
