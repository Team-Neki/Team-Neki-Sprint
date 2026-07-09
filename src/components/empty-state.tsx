import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * 공용 빈 상태(empty state). 기존 목록 페이지들이 각자 인라인으로 만들던 패턴
 * (Card + 아이콘 원형 + 안내 + 1차 CTA)을 한 컴포넌트로 통일한다. 아이콘·설명·
 * action 은 선택. DESIGN ex-empty-state-card(canvas-soft·넉넉한 패딩) 정합.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** 1차 CTA(생성 다이얼로그 트리거 등). 없으면 안내만. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn("flex flex-col items-center gap-3 py-16 text-center", className)}
    >
      {Icon && (
        <div className="bg-muted flex size-12 items-center justify-center rounded-full">
          <Icon className="text-muted-foreground size-6" aria-hidden />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>
      {action}
    </Card>
  );
}
