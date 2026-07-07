"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import type { Status, Priority } from "@prisma/client";
import { STATUS_ORDER, STATUS_META } from "@/lib/constants";
import { PriorityBadge } from "@/components/badges";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { Card } from "@/components/ui/card";
import { moveTask } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

export type BoardTask = {
  id: string;
  key: number;
  title: string;
  status: Status;
  priority: Priority;
  assignee: MiniUser | null;
  epic: { id: string; title: string; key: number } | null;
};

export function KanbanBoard({ tasks }: { tasks: BoardTask[] }) {
  const router = useRouter();
  const [items, setItems] = useState<BoardTask[]>(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Re-sync when the server sends fresh data.
  const signature = tasks.map((t) => `${t.id}:${t.status}`).join(",");
  useEffect(() => {
    setItems(tasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const columns = useMemo(() => {
    const map: Record<Status, BoardTask[]> = {
      BACKLOG: [],
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };
    for (const t of items) map[t.status].push(t);
    return map;
  }, [items]);

  const activeTask = items.find((t) => t.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const newStatus = String(overId) as Status;
    const task = items.find((t) => t.id === String(e.active.id));
    if (!task || task.status === newStatus) return;

    const prev = items;
    setItems((cur) =>
      cur.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)),
    );

    moveTask(task.id, newStatus)
      .then(() => router.refresh())
      .catch(() => {
        setItems(prev);
        toast.error("상태 변경에 실패했습니다");
      });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => (
          <Column key={status} status={status} tasks={columns[status]} />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, tasks }: { status: Status; tasks: BoardTask[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn("size-2 rounded-full", meta.dot)} />
        <span className="text-sm font-medium">{meta.label}</span>
        <span className="text-muted-foreground text-xs">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "bg-muted/40 flex min-h-[60vh] flex-col gap-2 rounded-lg p-2 transition-colors",
          isOver && "bg-accent ring-primary/30 ring-2",
        )}
      >
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
        {tasks.length === 0 && (
          <p className="text-muted-foreground/60 py-8 text-center text-xs">
            비어 있음
          </p>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, overlay }: { task: BoardTask; overlay?: boolean }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  return (
    <Card
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      onClick={() => !overlay && router.push(`/tasks/${task.id}`)}
      className={cn(
        "cursor-grab gap-2 rounded-md border p-3 shadow-sm active:cursor-grabbing",
        isDragging && "opacity-40",
        overlay && "rotate-3 shadow-lg",
      )}
    >
      <p className="text-sm leading-snug font-medium">{task.title}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground font-mono text-[11px]">
          TASK-{task.key}
        </span>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          <UserBadge user={task.assignee} hideName size="xs" />
        </div>
      </div>
      {task.epic && (
        <span className="text-muted-foreground truncate text-[11px]">
          {task.epic.title}
        </span>
      )}
    </Card>
  );
}
