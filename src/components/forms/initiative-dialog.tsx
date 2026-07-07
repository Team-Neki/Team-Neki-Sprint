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
  toDateInput,
} from "@/components/forms/fields";
import { createInitiative, updateInitiative } from "@/server/actions/initiatives";

type Existing = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  ownerId: string | null;
  startDate: Date | string | null;
  dueDate: Date | string | null;
};

export function InitiativeDialog({
  members,
  initiative,
  trigger,
}: {
  members: MiniUser[];
  initiative?: Existing;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [title, setTitle] = useState(initiative?.title ?? "");
  const [description, setDescription] = useState(initiative?.description ?? "");
  const [status, setStatus] = useState<Status>(initiative?.status ?? "BACKLOG");
  const [priority, setPriority] = useState<Priority>(
    initiative?.priority ?? "MEDIUM",
  );
  const [ownerId, setOwnerId] = useState<string | null>(
    initiative?.ownerId ?? null,
  );
  const [startDate, setStartDate] = useState(toDateInput(initiative?.startDate));
  const [dueDate, setDueDate] = useState(toDateInput(initiative?.dueDate));

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
      startDate,
      dueDate,
    };
    start(async () => {
      try {
        if (initiative) await updateInitiative(initiative.id, payload);
        else await createInitiative(payload);
        toast.success(initiative ? "수정했습니다" : "이니셔티브를 만들었습니다");
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
          <DialogTitle>
            {initiative ? "이니셔티브 수정" : "새 이니셔티브"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>제목</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2026 상반기 브랜드 캠페인"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>설명</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="목표와 배경을 적어주세요"
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
          <div className="grid gap-2">
            <Label>담당자</Label>
            <MemberSelect value={ownerId} onChange={setOwnerId} members={members} />
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
