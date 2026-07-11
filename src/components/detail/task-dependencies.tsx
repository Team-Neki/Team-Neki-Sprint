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
  addTaskDependency,
  removeTaskDependency,
} from "@/server/actions/tasks";
import { searchTasksAction } from "@/server/actions/wiki";
import { LinkSearchPopover, type LinkItem } from "@/components/wiki/link-search";
import { useInSheet } from "@/components/detail/in-sheet-context";

export type DepTask = {
  id: string;
  number: number;
  title: string;
  status: Status;
  teamKey: string | null;
};

/** 검색 결과를 LinkSearchPopover 아이템으로. (linked-tickets 와 동일 렌더) */
async function searchItems(query: string): Promise<LinkItem[]> {
  const rows = await searchTasksAction(query);
  return rows.map((t) => {
    const key = formatIssueKey(t.team?.key, t.number);
    return {
      id: t.id,
      label: `${key} ${t.title}`,
      node: (
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              STATUS_META[t.status].dot,
            )}
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

function DepList({
  items,
  onRemove,
  emptyLabel,
}: {
  items: DepTask[];
  onRemove: (id: string) => void;
  emptyLabel: string;
}) {
  const [pending, start] = useTransition();
  // 상세 시트 안에서는 다른 티켓 클릭 시(소프트 내비로 시트를 덮어쓰지 않고)
  // 전체 상세 페이지를 새 탭으로 연다.
  const inSheet = useInSheet();

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {items.map((t) => (
        <li
          key={t.id}
          className="group border-border bg-card flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              STATUS_META[t.status].dot,
            )}
          />
          <Link
            href={`/tasks/${t.id}`}
            target={inSheet ? "_blank" : undefined}
            rel={inSheet ? "noopener noreferrer" : undefined}
            className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
          >
            <span className="text-muted-foreground shrink-0 font-mono text-xs">
              {formatIssueKey(t.teamKey, t.number)}
            </span>
            <span className="truncate">{t.title}</span>
          </Link>
          <button
            type="button"
            onClick={() => start(() => onRemove(t.id))}
            disabled={pending}
            className="text-muted-foreground hover:text-destructive shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="의존성 제거"
            title="의존성 제거"
          >
            <X className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * 태스크 의존성 편집(blocks / blockedBy). 두 방향 리스트:
 * - blockers(나를 막는 항목): 현재 태스크가 blocked → addTaskDependency(picked, taskId)
 * - blocking(내가 막는 항목): 현재 태스크가 blocker → addTaskDependency(taskId, picked)
 * 순환/자기참조는 서버가 거부하고 토스트로 안내. 미완료 blocker 가 있으면 '차단됨' 표시.
 */
export function TaskDependencies({
  taskId,
  blockers,
  blocking,
}: {
  taskId: string;
  blockers: DepTask[];
  blocking: DepTask[];
}) {
  const router = useRouter();

  const openBlockerCount = blockers.filter((t) => t.status !== "DONE").length;
  // 자기 자신 + 이미 연결된 항목은 검색 결과에서 제외.
  const blockerExclude = [taskId, ...blockers.map((t) => t.id)];
  const blockingExclude = [taskId, ...blocking.map((t) => t.id)];

  async function addBlocker(blockerId: string) {
    try {
      await addTaskDependency(blockerId, taskId);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "의존성 추가에 실패했습니다");
    }
  }
  async function addBlocking(blockedId: string) {
    try {
      await addTaskDependency(taskId, blockedId);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "의존성 추가에 실패했습니다");
    }
  }
  function removeBlocker(blockerId: string) {
    removeTaskDependency(blockerId, taskId).then(() => router.refresh());
  }
  function removeBlocking(blockedId: string) {
    removeTaskDependency(taskId, blockedId).then(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-4">
      <section>
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">선행 작업</h3>
            {openBlockerCount > 0 && (
              <span className="bg-destructive/10 text-destructive rounded px-1.5 py-0.5 text-xs font-medium">
                미완료 {openBlockerCount}
              </span>
            )}
          </div>
          <LinkSearchPopover
            triggerLabel="추가"
            placeholder="먼저 끝나야 하는 티켓 검색…"
            emptyLabel="티켓이 없습니다"
            search={searchItems}
            onSelect={addBlocker}
            excludeIds={blockerExclude}
          />
        </div>
        <p className="text-muted-foreground mb-2 text-xs">
          이 작업을 시작하려면 먼저 끝나야 하는 항목
        </p>
        <DepList
          items={blockers}
          onRemove={removeBlocker}
          emptyLabel="선행 작업이 없습니다."
        />
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">후속 작업</h3>
          <LinkSearchPopover
            triggerLabel="추가"
            placeholder="이 작업을 기다리는 티켓 검색…"
            emptyLabel="티켓이 없습니다"
            search={searchItems}
            onSelect={addBlocking}
            excludeIds={blockingExclude}
          />
        </div>
        <p className="text-muted-foreground mb-2 text-xs">
          이 작업이 끝나야 시작할 수 있는 항목
        </p>
        <DepList
          items={blocking}
          onRemove={removeBlocking}
          emptyLabel="후속 작업이 없습니다."
        />
      </section>
    </div>
  );
}
