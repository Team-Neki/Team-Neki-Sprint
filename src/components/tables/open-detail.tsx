import Link from "next/link";
import { ArrowUpRight, PanelRight } from "lucide-react";
import { formatIssueKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * 목록 표의 "상세 열기" 액션.
 * - key(또는 패널 아이콘) 클릭: 소프트 내비게이션 → 목록 세그먼트의 intercepting
 *   route 를 태워 우측 슬라이드 상세를 연다(같은 목록 안에서만 인터셉트됨).
 * - ↗ 버튼: target=_blank 하드 로드 → 인터셉트되지 않고 전체 상세 페이지가 새 탭으로.
 */

const arrowCls =
  "text-muted-foreground hover:text-foreground hover:bg-accent inline-flex size-5 shrink-0 items-center justify-center rounded transition-colors";

function OpenNewTab({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="새 창에서 상세 열기"
      title="새 창에서 열기"
      className={arrowCls}
    >
      <ArrowUpRight className="size-3.5" />
    </a>
  );
}

/** 키 셀(tasks·epics). key 를 눌러 슬라이드, ↗ 로 새 탭. */
export function OpenDetailKey({
  href,
  teamKey,
  number,
}: {
  href: string;
  teamKey: string | null | undefined;
  number: number;
}) {
  return (
    <span className="flex items-center gap-1">
      <Link
        href={href}
        className="text-muted-foreground hover:text-foreground font-mono text-xs hover:underline"
      >
        {formatIssueKey(teamKey, number)}
      </Link>
      <OpenNewTab href={href} />
    </span>
  );
}

/** 아이콘 셀(projects — key 가 없음). 패널 아이콘으로 슬라이드, ↗ 로 새 탭. */
export function OpenDetailIcon({ href }: { href: string }) {
  return (
    <span className="flex items-center justify-end gap-1">
      <Link href={href} aria-label="상세 열기" title="상세 열기" className={cn(arrowCls)}>
        <PanelRight className="size-3.5" />
      </Link>
      <OpenNewTab href={href} />
    </span>
  );
}
