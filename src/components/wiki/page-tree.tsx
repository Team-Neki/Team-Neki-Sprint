"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { NewPageButton } from "@/components/wiki/new-page-button";

export type TreeNode = {
  id: string;
  title: string;
  parentId: string | null;
};

type Nested = TreeNode & { children: Nested[] };

function buildTree(nodes: TreeNode[]): Nested[] {
  const map = new Map<string, Nested>();
  nodes.forEach((n) => map.set(n.id, { ...n, children: [] }));
  const roots: Nested[] = [];
  map.forEach((n) => {
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(n);
    } else {
      roots.push(n);
    }
  });
  return roots;
}

export function PageTree({ nodes }: { nodes: TreeNode[] }) {
  const tree = buildTree(nodes);
  if (tree.length === 0) {
    return (
      <p className="text-muted-foreground px-2 py-4 text-center text-xs">
        아직 문서가 없습니다.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {tree.map((n) => (
        <TreeItem key={n.id} node={n} depth={0} />
      ))}
    </ul>
  );
}

function TreeItem({ node, depth }: { node: Nested; depth: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const active = pathname === `/wiki/${node.id}`;
  const hasChildren = node.children.length > 0;

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
          href={`/wiki/${node.id}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
        >
          <FileText className="text-muted-foreground size-3.5 shrink-0" />
          <span className="truncate">{node.title || "제목 없음"}</span>
        </Link>
        <span className="opacity-0 transition-opacity group-hover:opacity-100">
          <NewPageButton parentId={node.id} variant="icon" />
        </span>
      </div>
      {hasChildren && open && (
        <ul className="flex flex-col gap-0.5">
          {node.children.map((c) => (
            <TreeItem key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
