"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type FavoriteItem = { id: string; title: string };

/**
 * 현재 유저가 별표한 위키 페이지 목록. 좌측 사이드바 '콘텐츠' 위에 상주한다.
 * 별표한 문서가 없으면 렌더하지 않는다(빈 섹션으로 자리 차지 방지).
 */
export function FavoritesPanel({ favorites }: { favorites: FavoriteItem[] }) {
  const pathname = usePathname();
  if (favorites.length === 0) return null;

  return (
    <div>
      <h2 className="text-muted-foreground mb-1 flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide uppercase">
        <Star className="size-3.5" /> 즐겨찾기
      </h2>
      <ul className="flex flex-col gap-0.5">
        {favorites.map((f) => {
          const active = pathname === `/wiki/${f.id}`;
          return (
            <li key={f.id}>
              <Link
                href={`/wiki/${f.id}`}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm",
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-foreground hover:bg-accent/60",
                )}
              >
                <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
                <span className="truncate">{f.title || "제목 없음"}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
