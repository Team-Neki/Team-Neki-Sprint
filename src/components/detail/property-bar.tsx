"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { Status, Priority } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  STATUS_ORDER,
  STATUS_META,
  PRIORITY_ORDER,
  PRIORITY_META,
} from "@/lib/constants";
import { type MiniUser, initialsOf } from "@/components/user-badge";
import { cn } from "@/lib/utils";
import {
  setTaskStatus,
  setTaskPriority,
  setTaskAssignee,
} from "@/server/actions/tasks";
import {
  setEpicStatus,
  setEpicPriority,
  setEpicOwner,
} from "@/server/actions/epics";
import {
  setProjectStatus,
  setProjectPriority,
  setProjectOwner,
} from "@/server/actions/projects";

const UNASSIGNED = "__none__";

// 칩처럼 보이는 인라인 select 트리거: 보더 투명 + hover 시 인셋 면 노출.
const chipTrigger =
  "h-7 gap-1 border-transparent bg-transparent px-1.5 shadow-none hover:bg-accent";

type EntityType = "task" | "epic" | "project";

type TeamChip = { key: string; name: string; color?: string | null };

type FieldActions = {
  setStatus: (id: string, status: Status) => Promise<unknown>;
  setPriority: (id: string, priority: Priority) => Promise<unknown>;
  setAssignee: (id: string, assigneeId: string | null) => Promise<unknown>;
};

const ACTIONS: Record<EntityType, FieldActions> = {
  task: {
    setStatus: setTaskStatus,
    setPriority: setTaskPriority,
    setAssignee: setTaskAssignee,
  },
  epic: {
    setStatus: setEpicStatus,
    setPriority: setEpicPriority,
    setAssignee: setEpicOwner,
  },
  project: {
    setStatus: setProjectStatus,
    setPriority: setProjectPriority,
    setAssignee: setProjectOwner,
  },
};

/**
 * 상세 페이지 제목 아래에 붙는 단일 가로 라인 property bar (#6) + 인라인 편집 (#5).
 * 상태·담당자·우선순위는 클릭 즉시 select로 변경(경량 서버 액션 → router.refresh,
 * 낙관적 업데이트 없이 서버 확정 후 반영), 날짜는 표시 전용.
 */
export function PropertyBar({
  type,
  id,
  status,
  priority,
  assignee,
  members,
  startDate,
  dueDate,
  team,
}: {
  type: EntityType;
  id: string;
  status: Status;
  priority: Priority;
  assignee: MiniUser | null;
  members: MiniUser[];
  startDate?: Date | string | null;
  dueDate?: Date | string | null;
  team?: TeamChip | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const actions = ACTIONS[type];

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch {
        toast.error("변경에 실패했습니다");
      }
    });
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-1 gap-y-1.5 text-sm transition-opacity",
        pending && "opacity-60",
      )}
    >
      {team && (
        <>
          <span className="inline-flex items-center gap-1.5 px-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={team.color ? { backgroundColor: team.color } : undefined}
            />
            <span className="text-muted-foreground font-mono text-xs">
              {team.key}
            </span>
          </span>
          <Divider />
        </>
      )}

      <Select
        value={status}
        onValueChange={(v) => run(() => actions.setStatus(id, v as Status))}
      >
        <SelectTrigger
          size="sm"
          className={chipTrigger}
          disabled={pending}
          aria-label="상태 변경"
        >
          <span className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", STATUS_META[status].dot)} />
            <span className="font-medium">{STATUS_META[status].label}</span>
          </span>
        </SelectTrigger>
        <SelectContent align="start">
          {STATUS_ORDER.map((s) => (
            <SelectItem key={s} value={s}>
              <span className="flex items-center gap-2">
                <span className={cn("size-1.5 rounded-full", STATUS_META[s].dot)} />
                {STATUS_META[s].label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Divider />

      <Select
        value={assignee?.id ?? UNASSIGNED}
        onValueChange={(v) =>
          run(() => actions.setAssignee(id, v === UNASSIGNED ? null : v))
        }
      >
        <SelectTrigger
          size="sm"
          className={chipTrigger}
          disabled={pending}
          aria-label="담당자 변경"
        >
          {assignee ? (
            <span className="flex items-center gap-1.5">
              <Avatar className="size-5">
                {assignee.image && (
                  <AvatarImage src={assignee.image} alt={assignee.name ?? ""} />
                )}
                <AvatarFallback className="text-[10px]">
                  {initialsOf(assignee)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{assignee.name ?? assignee.email}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">미지정</span>
          )}
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value={UNASSIGNED}>미지정</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <span className="flex items-center gap-2">
                <Avatar className="size-5">
                  {m.image && <AvatarImage src={m.image} alt={m.name ?? ""} />}
                  <AvatarFallback className="text-[10px]">
                    {initialsOf(m)}
                  </AvatarFallback>
                </Avatar>
                {m.name ?? m.email}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Divider />

      <Select
        value={priority}
        onValueChange={(v) => run(() => actions.setPriority(id, v as Priority))}
      >
        <SelectTrigger
          size="sm"
          className={chipTrigger}
          disabled={pending}
          aria-label="우선순위 변경"
        >
          <span className={cn("font-medium", PRIORITY_META[priority].color)}>
            {PRIORITY_META[priority].label}
          </span>
        </SelectTrigger>
        <SelectContent align="start">
          {PRIORITY_ORDER.map((p) => (
            <SelectItem key={p} value={p}>
              <span className={PRIORITY_META[p].color}>
                {PRIORITY_META[p].label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(startDate || dueDate) && (
        <>
          <Divider />
          <DateRange startDate={startDate} dueDate={dueDate} />
        </>
      )}
    </div>
  );
}

function Divider() {
  return (
    <span aria-hidden className="text-muted-foreground/30 select-none">
      ·
    </span>
  );
}

function DateRange({
  startDate,
  dueDate,
}: {
  startDate?: Date | string | null;
  dueDate?: Date | string | null;
}) {
  const fmt = (d: Date | string) =>
    format(typeof d === "string" ? new Date(d) : d, "yyyy.M.d", { locale: ko });
  const single = dueDate ?? startDate;
  const label =
    startDate && dueDate ? `${fmt(startDate)} – ${fmt(dueDate)}` : single ? fmt(single) : "";

  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 px-1.5">
      <CalendarDays className="size-3.5" />
      {label}
    </span>
  );
}
