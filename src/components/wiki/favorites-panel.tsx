"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Star, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  renameWikiPage,
  deleteWikiPage,
  toggleWikiFavorite,
} from "@/server/actions/wiki";

export type FavoriteItem = { id: string; title: string };

/**
 * 현재 유저가 별표한 위키 페이지 목록. 좌측 사이드바 '콘텐츠' 위에 상주한다.
 * 별표한 문서가 없으면 렌더하지 않는다(빈 섹션으로 자리 차지 방지).
 * 각 항목 우클릭 → 별표 해제 / 이름 변경 / 삭제(휴지통) 컨텍스트 메뉴(page-tree 와 동일).
 */
export function FavoritesPanel({ favorites }: { favorites: FavoriteItem[] }) {
  if (favorites.length === 0) return null;

  return (
    <div>
      <h2 className="text-muted-foreground mb-1 flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide uppercase">
        <Star className="size-3.5" /> 즐겨찾기
      </h2>
      <ul className="flex flex-col gap-0.5">
        {favorites.map((f) => (
          <FavoriteRow key={f.id} fav={f} />
        ))}
      </ul>
    </div>
  );
}

function FavoriteRow({ fav }: { fav: FavoriteItem }) {
  const router = useRouter();
  const pathname = usePathname();
  const active = pathname === `/wiki/${fav.id}`;
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(fav.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, start] = useTransition();

  function submitRename() {
    const next = title.trim();
    if (!next || next === fav.title) {
      setRenaming(false);
      setTitle(fav.title);
      return;
    }
    start(async () => {
      try {
        await renameWikiPage(fav.id, next);
        setRenaming(false);
        router.refresh();
      } catch {
        toast.error("이름 변경에 실패했습니다");
      }
    });
  }

  function toggleStar() {
    start(async () => {
      try {
        await toggleWikiFavorite(fav.id);
        router.refresh();
      } catch {
        toast.error("별표 변경에 실패했습니다");
      }
    });
  }

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 text-sm",
            active
              ? "bg-accent text-accent-foreground font-medium"
              : "text-foreground hover:bg-accent/60",
          )}
        >
          {renaming ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitRename();
              }}
              className="min-w-0 flex-1 py-1"
            >
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={submitRename}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setRenaming(false);
                    setTitle(fav.title);
                  }
                }}
                className="h-6 px-1 text-sm"
              />
            </form>
          ) : (
            <Link
              href={`/wiki/${fav.id}`}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
            >
              <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
              <span className="truncate">{fav.title || "제목 없음"}</span>
            </Link>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={toggleStar}>
            <Star className="size-4 fill-amber-400 text-amber-400" /> 별표 해제
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              setTitle(fav.title);
              setRenaming(true);
            }}
          >
            <Pencil className="size-4" /> 이름 변경
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" /> 삭제
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <ConfirmDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={() => deleteWikiPage(fav.id)}
        redirectTo={active ? "/wiki" : undefined}
        title="이 페이지를 삭제할까요?"
        description="휴지통으로 이동합니다. 휴지통에서 복원할 수 있습니다."
      />
    </li>
  );
}
