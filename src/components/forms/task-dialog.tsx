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
  epicId: string | null;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  storyPoints: number | null;
};

export function TaskDialog({
  members,
  epics,
  task,
  defaultEpicId,
  defaultStatus,
  trigger,
}: {
  members: MiniUser[];
  epics: { id: string; title: string }[];
  task?: Existing;
  defaultEpicId?: string;
  defaultStatus?: Status;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

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
  const [startDate, setStartDate] = useState(toDateInput(task?.startDate));
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate));
  const [storyPoints, setStoryPoints] = useState(
    task?.storyPoints != null ? String(task.storyPoints) : "",
  );

  function submit() {
    if (!title.trim()) {
      toast.error("제목을 입력하세요");
      return;
    }
    const payload = {
      title,
      description,
      status,
      priority,
      assigneeId,
      epicId,
      startDate,
      dueDate,
      storyPoints: storyPoints === "" ? null : Number(storyPoints),
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
          <div className="grid gap-2">
            <Label>상위 에픽</Label>
            <GenericSelect
              value={epicId}
              onChange={setEpicId}
              options={epics.map((e) => ({ id: e.id, label: e.title }))}
              placeholder="에픽 선택"
              noneLabel="없음"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>상태</Label>
              <StatusSelect value={status} onChange={setStatus} />
            </div>
            <div className="grid gap-2">
              <Label>우선순위</Label>
              <PrioritySelect value={priority} onChange={setPriority} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>담당자</Label>
              <MemberSelect
                value={assigneeId}
                onChange={setAssigneeId}
                members={members}
              />
            </div>
            <div className="grid gap-2">
              <Label>스토리 포인트</Label>
              <Input
                type="number"
                min={0}
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                placeholder="예: 3"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
