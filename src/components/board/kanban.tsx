"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Status, Priority } from "@prisma/client";
import { STATUS_ORDER, STATUS_META, formatIssueKey } from "@/lib/constants";
import { PriorityBadge, BlockedBadge } from "@/components/badges";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { Card } from "@/components/ui/card";
import {
  TaskDialog,
  type TaskEpicOption,
} from "@/components/forms/task-dialog";
import type { TeamOption } from "@/components/forms/fields";
import { reorderBoardTask } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";

// 컬럼 하단 '추가하기' 버튼에 넘길 태스크 생성 폼 컨텍스트(멤버·팀·에픽·기본팀).
export type BoardCreateCtx = {
  members: MiniUser[];
  teams: TeamOption[];
  epics: TaskEpicOption[];
  defaultTeamId?: string;
};

export type BoardTask = {
  id: string;
  number: number;
  title: string;
  status: Status;
  priority: Priority;
  assignee: MiniUser | null;
  team: { key: string } | null;
  epic: { id: string; title: string } | null;
  // 미완료 blocker 가 있으면 true(차단됨 배지). getBoardTasks 에서 계산.
  blocked?: boolean;
};

type Columns = Record<Status, string[]>;

function buildColumns(tasks: BoardTask[]): Columns {
  const cols: Columns = {
    BACKLOG: [],
    TODO: [],
    IN_PROGRESS: [],
    DONE: [],
  };
  for (const t of tasks) cols[t.status].push(t.id);
  return cols;
}

function sameColumns(a: Columns, b: Columns) {
  return (Object.keys(a) as Status[]).every(
    (s) => a[s].length === b[s].length && a[s].every((id, i) => id === b[s][i]),
  );
}

export function KanbanBoard({
  tasks,
  createCtx,
}: {
  tasks: BoardTask[];
  createCtx: BoardCreateCtx;
}) {
  const router = useRouter();
  const byId = useMemo(
    () =>
      Object.fromEntries(tasks.map((t) => [t.id, t])) as Record<
        string,
        BoardTask
      >,
    [tasks],
  );

  const [columns, setColumns] = useState<Columns>(() => buildColumns(tasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  // 드래그 시작 시점 스냅샷 — 실패/취소 시 롤백, 변경 없음 판정용.
  const snapshot = useRef<Columns | null>(null);

  // 서버가 새 데이터를 보내면 재동기화. id:status 시퀀스로 서명해 순서 변화까지 반영.
  // 'adjust state during render' 패턴(useEffect + setState 대신, cascading render 회피).
  const signature = tasks.map((t) => `${t.id}:${t.status}`).join(",");
  const [prevSignature, setPrevSignature] = useState(signature);
  if (signature !== prevSignature) {
    setPrevSignature(signature);
    setColumns(buildColumns(tasks));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // id 가 컬럼(status)이면 그 컬럼, 태스크 id 면 그 태스크가 속한 컬럼을 찾는다.
  function findContainer(id: string): Status | undefined {
    if (id in columns) return id as Status;
    return (Object.keys(columns) as Status[]).find((s) =>
      columns[s].includes(id),
    );
  }

  function onDragStart(e: DragStartEvent) {
    snapshot.current = columns;
    setActiveId(String(e.active.id));
  }

  // 다른 컬럼 위로 넘어오면 로컬 상태에서 즉시 이동해 라이브 프리뷰(크로스컬럼).
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const dragId = String(active.id);
    const overId = String(over.id);
    const from = findContainer(dragId);
    const to = findContainer(overId);
    if (!from || !to || from === to) return;

    setColumns((prev) => {
      const toItems = prev[to];
      const overIndex = overId in prev ? toItems.length : toItems.indexOf(overId);
      const insertAt = overIndex < 0 ? toItems.length : overIndex;
      return {
        ...prev,
        [from]: prev[from].filter((i) => i !== dragId),
        [to]: [
          ...toItems.slice(0, insertAt),
          dragId,
          ...toItems.slice(insertAt),
        ],
      };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    const snap = snapshot.current;
    snapshot.current = null;
    if (!over || !snap) {
      if (snap) setColumns(snap);
      return;
    }

    const dragId = String(active.id);
    const overId = String(over.id);
    const from = findContainer(dragId);
    const to = findContainer(overId);
    if (!from || !to) {
      setColumns(snap);
      return;
    }

    // 같은 컬럼 내 재정렬은 여기서 확정(크로스컬럼은 onDragOver 가 이미 반영).
    let next = columns;
    if (from === to) {
      const items = columns[to];
      const oldIndex = items.indexOf(dragId);
      const newIndex =
        overId in columns ? items.length - 1 : items.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        next = { ...columns, [to]: arrayMove(items, oldIndex, newIndex) };
        setColumns(next);
      }
    }

    if (sameColumns(next, snap)) return; // 실제 변화 없음 → 서버 호출 스킵

    reorderBoardTask(dragId, to, next[to])
      .then(() => router.refresh())
      .catch(() => {
        setColumns(snap);
        toast.error("순서 변경에 실패했습니다");
      });
  }

  function onDragCancel() {
    setActiveId(null);
    if (snapshot.current) setColumns(snapshot.current);
    snapshot.current = null;
  }

  const activeTask = activeId ? byId[activeId] : null;

  return (
    <DndContext
      // 안정적 id 지정: 없으면 dnd-kit 이 draggable 의 aria-describedby 를
      // 자동증가 카운터(DndDescribedBy-N)로 만들어 SSR/CSR 값이 달라져(-0 vs -1)
      // hydration 불일치가 났다. 고정 id 를 주면 양쪽이 동일하게 렌더된다.
      id="board-dnd"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            taskIds={columns[status]}
            byId={byId}
            createCtx={createCtx}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  taskIds,
  byId,
  createCtx,
}: {
  status: Status;
  taskIds: string[];
  byId: Record<string, BoardTask>;
  createCtx: BoardCreateCtx;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn("size-2 rounded-full", meta.dot)} />
        <span className="text-sm font-medium">{meta.label}</span>
        <span className="text-muted-foreground text-xs">{taskIds.length}</span>
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "bg-muted/40 flex min-h-[60vh] flex-col gap-2 rounded-lg p-2 transition-colors",
            isOver && "bg-accent ring-primary/30 ring-2",
          )}
        >
          {taskIds.map((id) =>
            byId[id] ? <SortableCard key={id} task={byId[id]} /> : null,
          )}
          {taskIds.length === 0 && (
            <p className="text-muted-foreground/60 py-8 text-center text-xs">
              비어 있음
            </p>
          )}
          {/* 컬럼 하단: 이 상태로 새 태스크 추가(생성 다이얼로그를 status 프리셋으로 연다). */}
          <TaskDialog
            members={createCtx.members}
            teams={createCtx.teams}
            epics={createCtx.epics}
            defaultStatus={status}
            defaultTeamId={createCtx.defaultTeamId}
            trigger={
              <button
                type="button"
                className={cn(
                  // 카드와 같은 형태(rounded-md·p-3)지만 채움색을 빼고 dashed 보더 +
                  // 살짝 흐린 카드 느낌(bg-card/50). hover 시 실선 보더·불투명 카드·shadow 로 떠오름.
                  "flex w-full items-center gap-1.5 rounded-md border border-dashed border-border bg-card/50 p-3 text-left text-xs font-medium text-muted-foreground transition-all",
                  "hover:border-solid hover:bg-card hover:text-foreground hover:shadow-sm",
                )}
              >
                <Plus className="size-3.5" /> {meta.label} 추가하기
              </button>
            }
          />
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({ task }: { task: BoardTask }) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <TaskCard
        task={task}
        dragging={isDragging}
        onClick={() => router.push(`/tasks/${task.id}`)}
      />
    </div>
  );
}

function TaskCard({
  task,
  overlay,
  dragging,
  onClick,
}: {
  task: BoardTask;
  overlay?: boolean;
  dragging?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-grab gap-2 rounded-md border p-3 shadow-sm active:cursor-grabbing",
        dragging && "opacity-40",
        overlay && "rotate-3 shadow-lg",
      )}
    >
      <p className="text-sm leading-snug font-medium">{task.title}</p>
      {task.blocked && <BlockedBadge className="self-start" />}
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground font-mono text-[11px]">
          {formatIssueKey(task.team?.key, task.number)}
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
