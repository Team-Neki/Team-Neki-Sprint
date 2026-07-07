"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Status } from "@prisma/client";
import { STATUS_META, formatIssueKey } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  linkTaskToPage,
  unlinkTaskFromPage,
  searchTasksAction,
} from "@/server/actions/wiki";
import { LinkSearchPopover, type LinkItem } from "@/components/wiki/link-search";

export type LinkedTicket = {
  id: string;
  number: number;
  title: string;
  status: Status;
  teamKey: string | null;
};

export function LinkedTickets({
  pageId,
  tickets,
}: {
  pageId: string;
  tickets: LinkedTicket[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  async function search(query: string): Promise<LinkItem[]> {
    const rows = await searchTasksAction(query);
    return rows.map((t) => {
      const key = formatIssueKey(t.team?.key, t.number);
      return {
        id: t.id,
        label: `${key} ${t.title}`,
        node: (
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn("size-1.5 shrink-0 rounded-full", STATUS_META[t.status].dot)}
            />
            <span className="text-muted-foreground shrink-0 font-mono text-xs">
              {key}
            </span>
            <span className="truncate">{t.title}</span>
          </span>
        ),
      };
    });
  }

  async function add(taskId: string) {
    await linkTaskToPage(pageId, taskId);
    router.refresh();
  }

  function remove(taskId: string) {
    start(async () => {
      try {
        await unlinkTaskFromPage(pageId, taskId);
        router.refresh();
      } catch {
        toast.error("연결 해제에 실패했습니다");
      }
    });
  }

  return (
    <section className="mx-auto mt-8 max-w-3xl">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">연결된 티켓</h3>
        <LinkSearchPopover
          triggerLabel="티켓 연결"
          placeholder="티켓 key 또는 제목 검색…"
          emptyLabel="티켓이 없습니다"
          search={search}
          onSelect={add}
          excludeIds={tickets.map((t) => t.id)}
        />
      </div>
      {tickets.length === 0 ? (
        <p className="text-muted-foreground text-sm">연결된 티켓이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tickets.map((t) => (
            <li
              key={t.id}
              className="group border-border bg-card flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span
                className={cn("size-1.5 shrink-0 rounded-full", STATUS_META[t.status].dot)}
              />
              <Link
                href={`/tasks/${t.id}`}
                className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
              >
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                  {formatIssueKey(t.teamKey, t.number)}
                </span>
                <span className="truncate">{t.title}</span>
              </Link>
              <button
                type="button"
                onClick={() => remove(t.id)}
                disabled={pending}
                className="text-muted-foreground hover:text-destructive shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                title="연결 해제"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
