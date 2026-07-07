"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export type FavoriteItem = { id: string; title: string };

/**
 * 현재 유저가 별표한 위키 페이지 목록. 위키 레이아웃 우측에 상주하며, 별표 토글은
 * ⋯ 메뉴 / 트리 컨텍스트 메뉴에서 하고 여기(서버 refetch)로 반영된다.
 */
export function FavoritesPanel({ favorites }: { favorites: FavoriteItem[] }) {
  const pathname = usePathname();

  return (
    <div className="sticky top-20">
      <h2 className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Star className="size-3.5" /> 즐겨찾기
      </h2>
      {favorites.length === 0 ? (
        <p className="text-muted-foreground px-1 py-2 text-xs">
          별표한 문서가 없습니다.
        </p>
      ) : (
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
      )}
    </div>
  );
}
