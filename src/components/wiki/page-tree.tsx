"use client";

import { createContext, useContext, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronRight,
  FileText,
  FilePlus,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  createWikiPage,
  createWikiFolder,
  renameWikiFolder,
  deleteWikiFolder,
  renameWikiPage,
  deleteWikiPage,
  toggleWikiFavorite,
} from "@/server/actions/wiki";

export type PageNode = {
  id: string;
  title: string;
  parentId: string | null;
  folderId: string | null;
};

export type FolderNode = {
  id: string;
  name: string;
  parentId: string | null;
};

const ROOT = "__root__";

function pushInto<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

type Maps = {
  foldersByParent: Map<string, FolderNode[]>;
  topPagesByFolder: Map<string, PageNode[]>;
  pageChildrenByParent: Map<string, PageNode[]>;
  /** 폴더 삭제 시 folderId가 풀리는(보존되는) 페이지 수: 자신 + 하위 폴더 포함. */
  detachImpact: Map<string, number>;
};

function buildMaps(folders: FolderNode[], pages: PageNode[]): Maps {
  const pageIds = new Set(pages.map((p) => p.id));
  const foldersByParent = new Map<string, FolderNode[]>();
  const topPagesByFolder = new Map<string, PageNode[]>();
  const pageChildrenByParent = new Map<string, PageNode[]>();

  for (const f of folders) pushInto(foldersByParent, f.parentId ?? ROOT, f);

  // 페이지 배치: 부모 페이지가 있으면 그 아래 중첩(폴더 무관), 없으면 folderId로 배치.
  const pagesByFolderId = new Map<string, number>();
  for (const p of pages) {
    if (p.folderId) {
      pagesByFolderId.set(p.folderId, (pagesByFolderId.get(p.folderId) ?? 0) + 1);
    }
    const hasParent = !!p.parentId && pageIds.has(p.parentId);
    if (hasParent) {
      pushInto(pageChildrenByParent, p.parentId as string, p);
    } else {
      pushInto(topPagesByFolder, p.folderId ?? ROOT, p);
    }
  }

  // detach 영향: 폴더와 그 하위 폴더(Cascade 삭제)에 담긴 페이지 총합.
  const folderChildIds = new Map<string, string[]>();
  for (const f of folders) {
    if (f.parentId) pushInto(folderChildIds, f.parentId, f.id);
  }
  const detachImpact = new Map<string, number>();
  for (const f of folders) {
    let count = 0;
    const stack = [f.id];
    while (stack.length) {
      const id = stack.pop() as string;
      count += pagesByFolderId.get(id) ?? 0;
      const kids = folderChildIds.get(id);
      if (kids) stack.push(...kids);
    }
    detachImpact.set(f.id, count);
  }

  return { foldersByParent, topPagesByFolder, pageChildrenByParent, detachImpact };
}

/** 페이지 하위(재귀) 페이지 수. 삭제 경고 문구용. */
function countPageDescendants(maps: Maps, pageId: string): number {
  let count = 0;
  const stack = [...(maps.pageChildrenByParent.get(pageId) ?? [])];
  while (stack.length) {
    const p = stack.pop() as PageNode;
    count += 1;
    const kids = maps.pageChildrenByParent.get(p.id);
    if (kids) stack.push(...kids);
  }
  return count;
}

// 생성 액션 + 즐겨찾기 집합을 트리 전역에서 공유(프롭 드릴링 방지).
type TreeCtx = {
  addPage: (opts: { parentId?: string | null; folderId?: string | null }) => void;
  addFolder: (parentId: string | null) => void;
  favSet: Set<string>;
};
const Ctx = createContext<TreeCtx | null>(null);
function useTree() {
  const c = useContext(Ctx);
  if (!c) throw new Error("PageTree context missing");
  return c;
}

export function PageTree({
  pages,
  folders,
  favoriteIds = [],
}: {
  pages: PageNode[];
  folders: FolderNode[];
  favoriteIds?: string[];
}) {
  const router = useRouter();
  const [, start] = useTransition();

  const addPage = (opts: {
    parentId?: string | null;
    folderId?: string | null;
  }) =>
    start(async () => {
      try {
        const { id } = await createWikiPage({
          title: "제목 없음",
          parentId: opts.parentId ?? null,
          folderId: opts.folderId ?? null,
        });
        router.push(`/wiki/${id}`);
        router.refresh();
      } catch {
        toast.error("페이지 생성에 실패했습니다");
      }
    });

  const addFolder = (parentId: string | null) =>
    start(async () => {
      try {
        await createWikiFolder({ name: "새 폴더", parentId });
        router.refresh();
      } catch {
        toast.error("폴더 생성에 실패했습니다");
      }
    });

  const maps = buildMaps(folders, pages);
  const rootFolders = maps.foldersByParent.get(ROOT) ?? [];
  const rootPages = maps.topPagesByFolder.get(ROOT) ?? [];
  const isEmpty = rootFolders.length === 0 && rootPages.length === 0;

  return (
    <Ctx.Provider value={{ addPage, addFolder, favSet: new Set(favoriteIds) }}>
      <div className="mb-1 flex items-center justify-between gap-1 px-1">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          콘텐츠
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="hover:bg-accent text-muted-foreground hover:text-foreground rounded p-0.5"
                title="추가"
                aria-label="콘텐츠 추가"
              >
                <Plus className="size-4" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => addPage({})}>
              <FilePlus className="size-4" /> 새 페이지 추가
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => addFolder(null)}>
              <FolderPlus className="size-4" /> 폴더 추가
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isEmpty ? (
        <p className="text-muted-foreground px-2 py-4 text-center text-xs">
          아직 문서가 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {rootFolders.map((f) => (
            <FolderItem key={f.id} folder={f} depth={0} maps={maps} />
          ))}
          {rootPages.map((p) => (
            <PageItem key={p.id} page={p} depth={0} maps={maps} />
          ))}
        </ul>
      )}

      {/* 빈 공간 우클릭 → 추가 컨텍스트 메뉴. 목록 아래 여백을 우클릭해 새 페이지/폴더 추가. */}
      <ContextMenu>
        <ContextMenuTrigger
          aria-label="여기에 추가"
          className="mt-1 block min-h-24 w-full rounded-md"
        />
        <ContextMenuContent>
          <ContextMenuItem onClick={() => addPage({})}>
            <FilePlus className="size-4" /> 새 페이지 추가
          </ContextMenuItem>
          <ContextMenuItem onClick={() => addFolder(null)}>
            <FolderPlus className="size-4" /> 폴더 추가
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </Ctx.Provider>
  );
}

/** 행 우측 hover `+` 드롭다운(공용). items 를 받아 렌더. */
function RowAddMenu({
  items,
}: {
  items: { icon: React.ReactNode; label: string; onClick: () => void }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="hover:bg-accent text-muted-foreground hover:text-foreground rounded p-0.5"
            title="추가"
            aria-label="추가"
          >
            <Plus className="size-3.5" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-36">
        {items.map((it) => (
          <DropdownMenuItem key={it.label} onClick={it.onClick}>
            {it.icon} {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FolderItem({
  folder,
  depth,
  maps,
}: {
  folder: FolderNode;
  depth: number;
  maps: Maps;
}) {
  const { addFolder, addPage } = useTree();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folder.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, start] = useTransition();

  const subFolders = maps.foldersByParent.get(folder.id) ?? [];
  const folderPages = maps.topPagesByFolder.get(folder.id) ?? [];
  const hasChildren = subFolders.length > 0 || folderPages.length > 0;
  const impact = maps.detachImpact.get(folder.id) ?? 0;

  function submitRename() {
    const next = name.trim();
    if (!next || next === folder.name) {
      setRenaming(false);
      setName(folder.name);
      return;
    }
    start(async () => {
      try {
        await renameWikiFolder(folder.id, next);
        setRenaming(false);
        router.refresh();
      } catch {
        toast.error("이름 변경에 실패했습니다");
      }
    });
  }

  function cancelRename() {
    setRenaming(false);
    setName(folder.name);
  }

  const deleteDescription =
    impact > 0
      ? `이 폴더${subFolders.length > 0 ? "와 하위 폴더" : ""}가 삭제됩니다. 담긴 ${impact}개 문서는 삭제되지 않고 폴더에서 빠집니다.`
      : "이 폴더를 삭제합니다. 담긴 문서는 삭제되지 않습니다.";

  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger
          className="group hover:bg-accent/60 flex items-center gap-1 rounded-md pr-1 text-sm"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "text-muted-foreground shrink-0 rounded p-0.5",
              !hasChildren && "opacity-40",
            )}
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform",
                open && "rotate-90",
              )}
            />
          </button>
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={submitRename}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelRename();
                  }
                }}
                className="h-6 px-1 text-sm"
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
            >
              {open ? (
                <FolderOpen className="size-3.5 shrink-0 text-amber-500" />
              ) : (
                <Folder className="size-3.5 shrink-0 text-amber-500" />
              )}
              <span className="truncate font-medium">{folder.name}</span>
            </button>
          )}
          <span className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
            <RowAddMenu
              items={[
                {
                  icon: <FilePlus className="size-4" />,
                  label: "하위 페이지",
                  onClick: () => addPage({ folderId: folder.id }),
                },
                {
                  icon: <FolderPlus className="size-4" />,
                  label: "하위 폴더",
                  onClick: () => addFolder(folder.id),
                },
              ]}
            />
          </span>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => addPage({ folderId: folder.id })}>
            <FilePlus className="size-4" /> 하위 페이지 추가
          </ContextMenuItem>
          <ContextMenuItem onClick={() => addFolder(folder.id)}>
            <FolderPlus className="size-4" /> 하위 폴더 추가
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              setName(folder.name);
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

      {hasChildren && open && (
        <ul className="flex flex-col gap-0.5">
          {subFolders.map((f) => (
            <FolderItem key={f.id} folder={f} depth={depth + 1} maps={maps} />
          ))}
          {folderPages.map((p) => (
            <PageItem key={p.id} page={p} depth={depth + 1} maps={maps} />
          ))}
        </ul>
      )}

      <ConfirmDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={() => deleteWikiFolder(folder.id)}
        title="이 폴더를 삭제할까요?"
        description={deleteDescription}
      />
    </li>
  );
}

function PageItem({
  page,
  depth,
  maps,
}: {
  page: PageNode;
  depth: number;
  maps: Maps;
}) {
  const { addPage, favSet } = useTree();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, start] = useTransition();

  const active = pathname === `/wiki/${page.id}`;
  const children = maps.pageChildrenByParent.get(page.id) ?? [];
  const hasChildren = children.length > 0;
  const isFav = favSet.has(page.id);
  const descendantCount = countPageDescendants(maps, page.id);
  const deleteDescription =
    descendantCount > 0
      ? `하위 ${descendantCount}개 페이지도 함께 휴지통으로 이동합니다. 휴지통에서 복원할 수 있습니다.`
      : "휴지통으로 이동합니다. 휴지통에서 복원할 수 있습니다.";

  function submitRename() {
    const next = title.trim();
    if (!next || next === page.title) {
      setRenaming(false);
      setTitle(page.title);
      return;
    }
    start(async () => {
      try {
        await renameWikiPage(page.id, next);
        setRenaming(false);
        router.refresh();
      } catch {
        toast.error("이름 변경에 실패했습니다");
      }
    });
  }

  function cancelRename() {
    setRenaming(false);
    setTitle(page.title);
  }

  function toggleStar() {
    start(async () => {
      try {
        await toggleWikiFavorite(page.id);
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
            "group flex items-center gap-1 rounded-md pr-1.5 text-sm",
            active
              ? "bg-accent text-accent-foreground font-medium"
              : "hover:bg-accent/60 text-foreground",
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "text-muted-foreground shrink-0 rounded p-0.5",
              !hasChildren && "invisible",
            )}
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform",
                open && "rotate-90",
              )}
            />
          </button>
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
                    cancelRename();
                  }
                }}
                className="h-6 px-1 text-sm"
              />
            </form>
          ) : (
            <Link
              href={`/wiki/${page.id}`}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
            >
              <FileText className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate">{page.title || "제목 없음"}</span>
              {isFav && (
                <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
              )}
            </Link>
          )}
          <span className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
            <RowAddMenu
              items={[
                {
                  icon: <FilePlus className="size-4" />,
                  label: "하위 페이지",
                  onClick: () => addPage({ parentId: page.id }),
                },
              ]}
            />
          </span>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => addPage({ parentId: page.id })}>
            <FilePlus className="size-4" /> 하위 페이지 추가
          </ContextMenuItem>
          <ContextMenuItem onClick={toggleStar}>
            <Star
              className={
                isFav ? "size-4 fill-amber-400 text-amber-400" : "size-4"
              }
            />
            {isFav ? "별표 해제" : "별표"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => {
              setTitle(page.title);
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

      {hasChildren && open && (
        <ul className="flex flex-col gap-0.5">
          {children.map((c) => (
            <PageItem key={c.id} page={c} depth={depth + 1} maps={maps} />
          ))}
        </ul>
      )}

      <ConfirmDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={() => deleteWikiPage(page.id)}
        redirectTo={active ? "/wiki" : undefined}
        title="이 페이지를 삭제할까요?"
        description={deleteDescription}
      />
    </li>
  );
}
