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
import { createProject, updateProject } from "@/server/actions/projects";

type Existing = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  ownerId: string | null;
  sprintId: string | null;
  startDate: Date | string | null;
  dueDate: Date | string | null;
};

export function ProjectDialog({
  members,
  sprints,
  project,
  defaultSprintId,
  trigger,
}: {
  members: MiniUser[];
  sprints: { id: string; name: string }[];
  project?: Existing;
  defaultSprintId?: string;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<Status>(project?.status ?? "BACKLOG");
  const [priority, setPriority] = useState<Priority>(
    project?.priority ?? "MEDIUM",
  );
  const [ownerId, setOwnerId] = useState<string | null>(project?.ownerId ?? null);
  const [sprintId, setSprintId] = useState<string | null>(
    project?.sprintId ?? defaultSprintId ?? null,
  );
  const [startDate, setStartDate] = useState(toDateInput(project?.startDate));
  const [dueDate, setDueDate] = useState(toDateInput(project?.dueDate));

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
      ownerId,
      sprintId,
      startDate,
      dueDate,
    };
    start(async () => {
      try {
        if (project) await updateProject(project.id, payload);
        else await createProject(payload);
        toast.success(project ? "수정했습니다" : "프로젝트를 만들었습니다");
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
          <DialogTitle>{project ? "프로젝트 수정" : "새 프로젝트"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>제목</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 브랜드 캠페인 리뉴얼"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>설명</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="팀 횡단으로 진행할 작업의 목표와 배경"
            />
          </div>
          <div className="grid gap-2">
            <Label>스프린트</Label>
            <GenericSelect
              value={sprintId}
              onChange={setSprintId}
              options={sprints.map((s) => ({ id: s.id, label: s.name }))}
              placeholder="스프린트 선택"
              noneLabel="없음"
            />
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
          <div className="grid gap-2">
            <Label>담당자</Label>
            <MemberSelect value={ownerId} onChange={setOwnerId} members={members} />
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
              <Label>종료일</Label>
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
