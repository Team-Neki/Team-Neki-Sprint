"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SprintStatus } from "@prisma/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPRINT_STATUS_ORDER, SPRINT_STATUS_META } from "@/lib/constants";
import { toDateInput } from "@/components/forms/fields";
import { createSprint, updateSprint } from "@/server/actions/sprints";

type Existing = {
  id: string;
  name: string;
  status: SprintStatus;
  startDate: Date | string | null;
  endDate: Date | string | null;
};

export function SprintDialog({
  sprint,
  trigger,
}: {
  sprint?: Existing;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [name, setName] = useState(sprint?.name ?? "");
  const [status, setStatus] = useState<SprintStatus>(
    sprint?.status ?? "PLANNED",
  );
  const [startDate, setStartDate] = useState(toDateInput(sprint?.startDate));
  const [endDate, setEndDate] = useState(toDateInput(sprint?.endDate));

  function submit() {
    if (!name.trim()) {
      toast.error("이름을 입력하세요");
      return;
    }
    const payload = { name, status, startDate, endDate };
    start(async () => {
      try {
        if (sprint) await updateSprint(sprint.id, payload);
        else await createSprint(payload);
        toast.success(sprint ? "수정했습니다" : "스프린트를 만들었습니다");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{sprint ? "스프린트 수정" : "새 스프린트"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>이름</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 2026 상반기 스프린트"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label>상태</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as SprintStatus)}
            >
              <SelectTrigger>
                <SelectValue>
                  {(v: SprintStatus) => (
                    <span className="flex items-center gap-2">
                      <span
                        className={`size-1.5 rounded-full ${SPRINT_STATUS_META[v].dot}`}
                      />
                      {SPRINT_STATUS_META[v].label}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SPRINT_STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span
                        className={`size-1.5 rounded-full ${SPRINT_STATUS_META[s].dot}`}
                      />
                      {SPRINT_STATUS_META[s].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
