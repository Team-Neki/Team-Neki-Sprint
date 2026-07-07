"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ConfirmDelete } from "@/components/confirm-delete";
import { NewPageButton } from "@/components/wiki/new-page-button";
import { NewFolderButton } from "@/components/wiki/new-folder-button";
import { renameWikiFolder, deleteWikiFolder } from "@/server/actions/wiki";

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

export function PageTree({
  pages,
  folders,
}: {
  pages: PageNode[];
  folders: FolderNode[];
}) {
  const maps = buildMaps(folders, pages);
  const rootFolders = maps.foldersByParent.get(ROOT) ?? [];
  const rootPages = maps.topPagesByFolder.get(ROOT) ?? [];

  if (rootFolders.length === 0 && rootPages.length === 0) {
    return (
      <p className="text-muted-foreground px-2 py-4 text-center text-xs">
        아직 문서가 없습니다.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {rootFolders.map((f) => (
        <FolderItem key={f.id} folder={f} depth={0} maps={maps} />
      ))}
      {rootPages.map((p) => (
        <PageItem key={p.id} page={p} depth={0} maps={maps} />
      ))}
    </ul>
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
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folder.name);

  const subFolders = maps.foldersByParent.get(folder.id) ?? [];
  const folderPages = maps.topPagesByFolder.get(folder.id) ?? [];
  const hasChildren = subFolders.length > 0 || folderPages.length > 0;
  const impact = maps.detachImpact.get(folder.id) ?? 0;

  async function submitRename() {
    const next = name.trim();
    if (!next || next === folder.name) {
      setRenaming(false);
      return;
    }
    try {
      await renameWikiFolder(folder.id, next);
      setRenaming(false);
      router.refresh();
    } catch {
      toast.error("이름 변경에 실패했습니다");
    }
  }

  const deleteDescription =
    impact > 0
      ? `이 폴더${subFolders.length > 0 ? "와 하위 폴더" : ""}가 삭제됩니다. 담긴 ${impact}개 문서는 삭제되지 않고 폴더에서 빠집니다.`
      : "이 폴더를 삭제합니다. 담긴 문서는 삭제되지 않습니다.";

  return (
    <li>
      <div
        className={cn(
          "group hover:bg-accent/60 flex items-center gap-1 rounded-md pr-1 text-sm",
        )}
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
            className={cn("size-3.5 transition-transform", open && "rotate-90")}
          />
        </button>
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
        <span className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
          <NewPageButton
            folderId={folder.id}
            variant="icon"
            title="이 폴더에 페이지 추가"
          />
          <NewFolderButton parentId={folder.id} variant="icon" />
          <Popover open={renaming} onOpenChange={setRenaming}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="hover:bg-accent text-muted-foreground hover:text-foreground rounded p-0.5"
                  title="폴더 이름 변경"
                  onClick={() => setName(folder.name)}
                >
                  <Pencil className="size-3.5" />
                </button>
              }
            />
            <PopoverContent align="start" className="w-56">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitRename();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8"
                />
                <Button type="submit" size="sm" className="h-8 shrink-0">
                  변경
                </Button>
              </form>
            </PopoverContent>
          </Popover>
          <ConfirmDelete
            onConfirm={() => deleteWikiFolder(folder.id)}
            title="이 폴더를 삭제할까요?"
            description={deleteDescription}
            trigger={
              <button
                type="button"
                className="hover:bg-accent text-muted-foreground hover:text-destructive rounded p-0.5"
                title="폴더 삭제"
              >
                <Trash2 className="size-3.5" />
              </button>
            }
          />
        </span>
      </div>
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
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const active = pathname === `/wiki/${page.id}`;
  const children = maps.pageChildrenByParent.get(page.id) ?? [];
  const hasChildren = children.length > 0;

  return (
    <li>
      <div
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
            className={cn("size-3.5 transition-transform", open && "rotate-90")}
          />
        </button>
        <Link
          href={`/wiki/${page.id}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
        >
          <FileText className="text-muted-foreground size-3.5 shrink-0" />
          <span className="truncate">{page.title || "제목 없음"}</span>
        </Link>
        <span className="opacity-0 transition-opacity group-hover:opacity-100">
          <NewPageButton parentId={page.id} variant="icon" />
        </span>
      </div>
      {hasChildren && open && (
        <ul className="flex flex-col gap-0.5">
          {children.map((c) => (
            <PageItem key={c.id} page={c} depth={depth + 1} maps={maps} />
          ))}
        </ul>
      )}
    </li>
  );
}
