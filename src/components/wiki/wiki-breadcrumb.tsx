import Link from "next/link";
import { ChevronRight, Folder } from "lucide-react";
import type { WikiCrumb } from "@/lib/wiki-breadcrumb";

/**
 * 위키 페이지 상단 조상 경로. 폴더는 라우트가 없어 라벨만, 조상 페이지는 링크.
 * 조상이 없으면 아무것도 렌더하지 않는다(순수 표시 컴포넌트, 서버에서 렌더 가능).
 */
export function WikiBreadcrumb({ items }: { items: WikiCrumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="페이지 경로"
      className="text-muted-foreground mb-2 flex flex-wrap items-center gap-1 text-xs"
    >
      {items.map((it, i) => (
        <span key={it.id} className="flex min-w-0 items-center gap-1">
          {i > 0 && <ChevronRight className="size-3 shrink-0 opacity-60" />}
          {it.href ? (
            <Link
              href={it.href}
              className="hover:text-foreground max-w-[12rem] truncate hover:underline"
            >
              {it.label}
            </Link>
          ) : (
            <span className="flex max-w-[12rem] items-center gap-1 truncate">
              <Folder className="size-3 shrink-0 opacity-70" />
              {it.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
