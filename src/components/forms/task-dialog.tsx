"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Status, Priority } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MiniUser } from "@/components/user-badge";
import {
  StatusSelect,
  PrioritySelect,
  MemberSelect,
  GenericSelect,
  TeamSelect,
  type TeamOption,
  toDateInput,
} from "@/components/forms/fields";
import { createTask, updateTask } from "@/server/actions/tasks";

type Existing = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  assigneeId: string | null;
  teamId: string;
  epicId: string | null;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  estimatedMd: number | null;
  actualMd: number | null;
};

export type TaskEpicOption = { id: string; title: string; teamId: string };

export function TaskDialog({
  members,
  teams,
  epics,
  task,
  defaultEpicId,
  defaultTeamId,
  defaultStatus,
  trigger,
}: {
  members: MiniUser[];
  teams: TeamOption[];
  epics: TaskEpicOption[];
  task?: Existing;
  defaultEpicId?: string;
  defaultTeamId?: string;
  defaultStatus?: Status;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const isEdit = !!task;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<Status>(
    task?.status ?? defaultStatus ?? "TODO",
  );
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "MEDIUM");
  const [assigneeId, setAssigneeId] = useState<string | null>(
    task?.assigneeId ?? null,
  );
  const [epicId, setEpicId] = useState<string | null>(
    task?.epicId ?? defaultEpicId ?? null,
  );
  // 에픽이 지정되면 팀은 그 에픽의 팀을 상속(서버에서도 강제). 없으면 직접 선택.
  const epicTeamId = epicId
    ? (epics.find((e) => e.id === epicId)?.teamId ?? null)
    : null;
  const [teamId, setTeamId] = useState<string | null>(
    task?.teamId ?? defaultTeamId ?? null,
  );
  const effectiveTeamId = epicTeamId ?? teamId;

  const [startDate, setStartDate] = useState(toDateInput(task?.startDate));
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate));
  const [estimatedMd, setEstimatedMd] = useState(
    task?.estimatedMd != null ? String(task.estimatedMd) : "",
  );
  const [actualMd, setActualMd] = useState(
    task?.actualMd != null ? String(task.actualMd) : "",
  );

  function onEpicChange(next: string | null) {
    setEpicId(next);
    const t = next ? epics.find((e) => e.id === next)?.teamId : null;
    if (t) setTeamId(t);
  }

  function submit() {
    if (!title.trim()) {
      toast.error("제목을 입력하세요");
      return;
    }
    if (!isEdit && !effectiveTeamId) {
      toast.error("팀을 선택하거나 에픽을 지정하세요");
      return;
    }
    const payload = {
      title,
      description,
      status,
      priority,
      assigneeId,
      teamId: effectiveTeamId ?? task?.teamId,
      epicId,
      startDate,
      dueDate,
      estimatedMd: estimatedMd === "" ? null : Number(estimatedMd),
      actualMd: actualMd === "" ? null : Number(actualMd),
    };
    start(async () => {
      try {
        if (task) await updateTask(task.id, payload);
        else await createTask(payload);
        toast.success(task ? "수정했습니다" : "태스크를 만들었습니다");
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("저장에 실패했습니다");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "태스크 수정" : "새 태스크"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>제목</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 히어로 배너 카피 작성"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>설명</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>상위 에픽</Label>
              <GenericSelect
                value={epicId}
                onChange={onEpicChange}
                options={epics.map((e) => ({ id: e.id, label: e.title }))}
                placeholder="에픽 선택"
                noneLabel="없음"
              />
            </div>
            <div className="grid gap-2">
              <Label>
                소유 팀
                {isEdit
                  ? " (변경 불가)"
                  : epicTeamId
                    ? " (에픽 상속)"
                    : ""}
              </Label>
              {isEdit || epicTeamId ? (
                <TeamKeyReadonly teams={teams} teamId={effectiveTeamId} />
              ) : (
                <TeamSelect value={teamId} onChange={setTeamId} teams={teams} />
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>상태</Label>
              <StatusSelect value={status} onChange={setStatus} />
            </div>
            <div className="grid gap-2">
              <Label>우선순위</Label>
              <PrioritySelect value={priority} onChange={setPriority} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>담당자</Label>
              <MemberSelect
                value={assigneeId}
                onChange={setAssigneeId}
                members={members}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>예상 MD</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={estimatedMd}
                onChange={(e) => setEstimatedMd(e.target.value)}
                placeholder="예: 2"
              />
            </div>
            <div className="grid gap-2">
              <Label>실제 MD</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={actualMd}
                onChange={(e) => setActualMd(e.target.value)}
                placeholder="예: 1.5"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>시작일</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>마감일</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 팀이 고정된 경우(수정/에픽 상속) 팀 key를 읽기 전용으로 표시. */
function TeamKeyReadonly({
  teams,
  teamId,
}: {
  teams: TeamOption[];
  teamId: string | null;
}) {
  const team = teams.find((t) => t.id === teamId);
  return (
    <div className="border-input bg-muted/40 text-muted-foreground flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
      <span
        className="size-2 shrink-0 rounded-full"
        style={team?.color ? { backgroundColor: team.color } : undefined}
      />
      <span className="font-mono text-xs">{team?.key ?? "—"}</span>
      <span>{team?.name}</span>
    </div>
  );
}
