"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";
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
  folderKey,
  pageKey,
  parseCollapsed,
  serializeCollapsed,
} from "@/components/wiki/wiki-collapsed";
import {
  createWikiPage,
  createWikiFolder,
  renameWikiFolder,
  deleteWikiFolder,
  renameWikiPage,
  deleteWikiPage,
  restoreWikiPage,
  toggleWikiFavorite,
  moveWikiPage,
} from "@/server/actions/wiki";

/** 드롭 위치 의도. before/after=형제 재정렬, into=대상의 하위로 중첩. */
type DropZone = "before" | "into" | "after";

type MoveTarget = {
  parentId: string | null;
  folderId: string | null;
  beforeId: string | null;
};

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
      pagesByFolderId.set(
        p.folderId,
        (pagesByFolderId.get(p.folderId) ?? 0) + 1,
      );
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

  return {
    foldersByParent,
    topPagesByFolder,
    pageChildrenByParent,
    detachImpact,
  };
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

// 생성 액션 + 즐겨찾기 집합 + 드래그 이동 상태를 트리 전역에서 공유(프롭 드릴링 방지).
type TreeCtx = {
  addPage: (opts: {
    parentId?: string | null;
    folderId?: string | null;
  }) => void;
  addFolder: (parentId: string | null) => void;
  favSet: Set<string>;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  move: (pageId: string, target: MoveTarget) => void;
  /** 방금 생성돼 사이드바에서 바로 이름을 지정할(rename 모드로 열릴) 노드 id. */
  pendingRenameId: string | null;
  clearPendingRename: () => void;
  // 접힘 상태를 트리 최상위에서 소유해 자식 <ul> 언마운트에도 보존한다.
  // (자식이 local useState 로 open 을 들면 부모 접힘→재펼침 때 open=true 로 초기화되던 버그.)
  // 기본값은 '펼침'이고 collapsedIds 에 든 key 만 접힌 것으로 본다. key 는 `f:`/`p:` 로 네임스페이스.
  isCollapsed: (key: string) => boolean;
  toggleCollapsed: (key: string) => void;
  /** key 를 접힘 집합에서 빼서 강제로 펼친다(하위 항목 생성 직후 노출용). */
  expand: (key: string) => void;
};

// 접힘 상태 localStorage 키. JSON 문자열 배열로 저장한다(파싱/직렬화는 wiki-collapsed).
const COLLAPSED_STORAGE_KEY = "wiki:collapsed";

function readCollapsedFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return parseCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY));
  } catch {
    return new Set();
  }
}
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
  const [dragId, setDragId] = useState<string | null>(null);
  // 생성 직후 rename 모드로 열릴 노드. 새로 마운트된 항목이 자기 id면 소비하고 비운다.
  const [pendingRenameId, setPendingRenameId] = useState<string | null>(null);

  // 사용자가 명시적으로 접은 항목의 key 집합. 기본은 펼침이므로 여기 없는 항목은 open.
  // 최상위에서 소유하므로 자식 <ul> 언마운트/재마운트에도 접힘 상태가 유지된다.
  // SSR 에선 localStorage 접근 불가 → initializer 에서 window 존재할 때만 복원한다.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    readCollapsedFromStorage,
  );

  const persistCollapsed = (next: Set<string>) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        COLLAPSED_STORAGE_KEY,
        serializeCollapsed(next),
      );
    } catch {
      // localStorage 쓰기 실패(용량/프라이버시 모드)는 무시 — 접힘은 메모리로도 동작.
    }
  };

  const isCollapsed = (key: string) => collapsedIds.has(key);
  const toggleCollapsed = (key: string) =>
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persistCollapsed(next);
      return next;
    });
  const expand = (key: string) =>
    setCollapsedIds((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      persistCollapsed(next);
      return next;
    });

  // 순환 방지용 페이지→부모 맵. 드롭 대상이 드래그 페이지의 하위인지 판정한다.
  const pageParent = new Map<string, string | null>();
  for (const p of pages) pageParent.set(p.id, p.parentId);
  const isSelfOrDescendant = (pageId: string, targetParentId: string) => {
    let cur: string | null = targetParentId;
    const seen = new Set<string>();
    while (cur) {
      if (cur === pageId) return true;
      if (seen.has(cur)) return false;
      seen.add(cur);
      cur = pageParent.get(cur) ?? null;
    }
    return false;
  };

  const move = (pageId: string, target: MoveTarget) => {
    // 이동은 콘텐츠 트리 내부 한정. 새 부모가 자기 자신/하위면 순환이라 거부.
    if (target.parentId && isSelfOrDescendant(pageId, target.parentId)) {
      toast.error("하위 문서로는 이동할 수 없습니다");
      return;
    }
    start(async () => {
      try {
        await moveWikiPage(pageId, target);
        router.refresh();
      } catch {
        toast.error("이동에 실패했습니다");
      }
    });
  };

  const addPage = (opts: {
    parentId?: string | null;
    folderId?: string | null;
  }) =>
    start(async () => {
      try {
        // 부모 페이지/폴더 아래에 만들 때 접혀 있으면 펼쳐 새 페이지가 바로 보이게 한다.
        if (opts.parentId) expand(pageKey(opts.parentId));
        if (opts.folderId) expand(folderKey(opts.folderId));
        const { id } = await createWikiPage({
          title: "제목 없음",
          parentId: opts.parentId ?? null,
          folderId: opts.folderId ?? null,
        });
        setPendingRenameId(id);
        router.push(`/wiki/${id}`);
        router.refresh();
      } catch {
        toast.error("페이지 생성에 실패했습니다");
      }
    });

  const addFolder = (parentId: string | null) =>
    start(async () => {
      try {
        // 하위 폴더 생성 시 부모가 접혀 있으면 펼쳐 새 폴더가 바로 보이게 한다.
        // (접힌 부모의 자식 <ul> 은 렌더 게이트에 막혀 안 보이던 버그 방지.)
        if (parentId) expand(folderKey(parentId));
        const { id } = await createWikiFolder({ name: "새 폴더", parentId });
        // 새로 만든 폴더 자신은 접힘 집합에서 빼 항상 펼친 상태로 시작한다.
        expand(folderKey(id));
        setPendingRenameId(id);
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
    <Ctx.Provider
      value={{
        addPage,
        addFolder,
        favSet: new Set(favoriteIds),
        dragId,
        setDragId,
        move,
        pendingRenameId,
        clearPendingRename: () => setPendingRenameId(null),
        isCollapsed,
        toggleCollapsed,
        expand,
      }}
    >
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
            <PageItem
              key={p.id}
              page={p}
              depth={0}
              maps={maps}
              siblings={rootPages}
            />
          ))}
        </ul>
      )}

      {/* 빈 공간 우클릭 → 추가 컨텍스트 메뉴. 여기에 드롭하면 최상위(루트)로 이동. */}
      <ContextMenu>
        <ContextMenuTrigger
          aria-label="여기에 추가 · 루트로 이동"
          className={cn(
            "mt-1 block min-h-10 w-full rounded-md transition-colors",
            dragId &&
              "outline-border/70 outline-2 -outline-offset-2 outline-dashed",
          )}
          onDragOver={(e) => {
            if (dragId) e.preventDefault();
          }}
          onDrop={(e) => {
            if (!dragId) return;
            e.preventDefault();
            move(dragId, { parentId: null, folderId: null, beforeId: null });
            setDragId(null);
          }}
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
  const {
    addFolder,
    addPage,
    dragId,
    setDragId,
    move,
    pendingRenameId,
    clearPendingRename,
    isCollapsed,
    toggleCollapsed,
    expand,
  } = useTree();
  const router = useRouter();
  // 접힘 상태는 트리 최상위가 소유(TreeContext) — 자식 언마운트에도 보존된다.
  const key = folderKey(folder.id);
  const open = !isCollapsed(key);
  // 방금 생성된 폴더면 rename 모드로 시작해 바로 이름을 입력받는다.
  const [renaming, setRenaming] = useState(() => pendingRenameId === folder.id);
  const [name, setName] = useState(folder.name);

  useEffect(() => {
    if (pendingRenameId === folder.id) clearPendingRename();
  }, [pendingRenameId, folder.id, clearPendingRename]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dropInto, setDropInto] = useState(false);
  const [, start] = useTransition();

  const subFolders = maps.foldersByParent.get(folder.id) ?? [];
  const folderPages = maps.topPagesByFolder.get(folder.id) ?? [];
  const hasChildren = subFolders.length > 0 || folderPages.length > 0;
  const impact = maps.detachImpact.get(folder.id) ?? 0;

  // 하위 항목 추가 시 이 폴더를 펼쳐(expand) 새 항목이 바로 보이게 한다.
  // 접힌 폴더(open=false)에 추가하면 아래 `hasChildren && open` 게이트에 막혀
  // 새로 만든 폴더/페이지가 렌더되지 않던 버그를 막는다.
  const addSubPage = () => {
    expand(key);
    addPage({ folderId: folder.id });
  };
  const addSubFolder = () => {
    expand(key);
    addFolder(folder.id);
  };

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
        // 실패 시 편집값을 원래 이름으로 되돌린다.
        setName(folder.name);
        setRenaming(false);
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
          className={cn(
            "group hover:bg-accent/60 flex items-center gap-1 rounded-md pr-1 text-sm",
            dropInto && "ring-link bg-accent/40 ring-2 ring-inset",
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onDragOver={(e) => {
            if (!dragId) return;
            e.preventDefault();
            setDropInto(true);
          }}
          onDragLeave={() => setDropInto(false)}
          onDrop={(e) => {
            if (!dragId) return;
            e.preventDefault();
            setDropInto(false);
            // 폴더로 이동: 최상위(부모 페이지 해제) + 이 폴더 소속 맨 끝에 배치.
            move(dragId, {
              parentId: null,
              folderId: folder.id,
              beforeId: null,
            });
            setDragId(null);
            expand(key);
          }}
        >
          <button
            type="button"
            onClick={() => toggleCollapsed(key)}
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
                onFocus={(e) => e.currentTarget.select()}
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
              onClick={() => toggleCollapsed(key)}
              onDoubleClick={() => {
                setName(folder.name);
                setRenaming(true);
              }}
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
                  onClick: addSubPage,
                },
                {
                  icon: <FolderPlus className="size-4" />,
                  label: "하위 폴더",
                  onClick: addSubFolder,
                },
              ]}
            />
          </span>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={addSubPage}>
            <FilePlus className="size-4" /> 하위 페이지 추가
          </ContextMenuItem>
          <ContextMenuItem onClick={addSubFolder}>
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
            <PageItem
              key={p.id}
              page={p}
              depth={depth + 1}
              maps={maps}
              siblings={folderPages}
            />
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
  siblings,
}: {
  page: PageNode;
  depth: number;
  maps: Maps;
  /** 같은 컨테이너의 형제 목록(position 순). after 드롭 시 다음 형제 계산에 쓴다. */
  siblings: PageNode[];
}) {
  const {
    addPage,
    favSet,
    dragId,
    setDragId,
    move,
    pendingRenameId,
    clearPendingRename,
    isCollapsed,
    toggleCollapsed,
    expand,
  } = useTree();
  const router = useRouter();
  const pathname = usePathname();
  // 접힘 상태는 트리 최상위가 소유(TreeContext) — 자식 언마운트에도 보존된다.
  const key = pageKey(page.id);
  const open = !isCollapsed(key);
  // 방금 생성된 페이지면 rename 모드로 시작해 바로 제목을 입력받는다.
  const [renaming, setRenaming] = useState(() => pendingRenameId === page.id);
  const [title, setTitle] = useState(page.title);

  useEffect(() => {
    if (pendingRenameId === page.id) clearPendingRename();
  }, [pendingRenameId, page.id, clearPendingRename]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [zone, setZone] = useState<DropZone | null>(null);
  const [, start] = useTransition();

  // after 드롭 = 이 페이지 "뒤"에 삽입 = 다음 형제 앞(없으면 맨 끝).
  const sibIdx = siblings.findIndex((s) => s.id === page.id);
  const nextSiblingId =
    sibIdx >= 0 && sibIdx + 1 < siblings.length
      ? siblings[sibIdx + 1].id
      : null;

  const isDragging = dragId === page.id;

  // 하위 페이지 추가 시 이 페이지를 펼쳐(expand) 새 페이지가 바로 보이게 한다.
  // 접힌 상태(open=false)에선 아래 `hasChildren && open` 게이트에 막혀 안 보이던 버그 방지.
  const addSubPage = () => {
    expand(key);
    addPage({ parentId: page.id });
  };

  function onDragOver(e: React.DragEvent) {
    if (!dragId || dragId === page.id) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const z: DropZone =
      y < rect.height * 0.3
        ? "before"
        : y > rect.height * 0.7
          ? "after"
          : "into";
    setZone(z);
  }

  function onDrop() {
    const id = dragId;
    const z = zone;
    setZone(null);
    setDragId(null);
    if (!id || id === page.id || !z) return;
    if (z === "into") {
      // 하위 페이지로 중첩: 이 페이지의 자식 맨 끝. folderId 는 부모를 따른다.
      move(id, { parentId: page.id, folderId: page.folderId, beforeId: null });
    } else if (z === "before") {
      move(id, {
        parentId: page.parentId,
        folderId: page.folderId,
        beforeId: page.id,
      });
    } else {
      move(id, {
        parentId: page.parentId,
        folderId: page.folderId,
        beforeId: nextSiblingId,
      });
    }
  }

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
        // 실패 시 낙관적 편집값을 원래 제목으로 되돌려 화면에 남지 않게 한다.
        setTitle(page.title);
        setRenaming(false);
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
          draggable={!renaming}
          onDragStart={(e) => {
            setDragId(page.id);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", page.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setZone(null);
          }}
          onDragOver={onDragOver}
          onDragLeave={() => setZone(null)}
          onDrop={(e) => {
            e.preventDefault();
            onDrop();
          }}
          className={cn(
            "group relative flex items-center gap-1 rounded-md pr-1.5 text-sm",
            active
              ? "bg-accent text-accent-foreground font-medium"
              : "hover:bg-accent/60 text-foreground",
            isDragging && "opacity-50",
            zone === "into" && "ring-link bg-accent/40 ring-2 ring-inset",
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {zone === "before" && (
            <span className="bg-link pointer-events-none absolute inset-x-1 top-0 h-0.5 rounded-full" />
          )}
          {zone === "after" && (
            <span className="bg-link pointer-events-none absolute inset-x-1 bottom-0 h-0.5 rounded-full" />
          )}
          <button
            type="button"
            onClick={() => toggleCollapsed(key)}
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
                onFocus={(e) => e.currentTarget.select()}
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
              onDoubleClick={(e) => {
                // 더블클릭 = 제목 인라인 편집(네비게이션 막고 편집 모드 진입).
                e.preventDefault();
                setTitle(page.title);
                setRenaming(true);
              }}
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
                  onClick: addSubPage,
                },
              ]}
            />
          </span>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={addSubPage}>
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
            <PageItem
              key={c.id}
              page={c}
              depth={depth + 1}
              maps={maps}
              siblings={children}
            />
          ))}
        </ul>
      )}

      <ConfirmDelete
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={() => deleteWikiPage(page.id)}
        undo={() => restoreWikiPage(page.id)}
        redirectTo={active ? "/wiki" : undefined}
        title="이 페이지를 삭제할까요?"
        description={deleteDescription}
      />
    </li>
  );
}
