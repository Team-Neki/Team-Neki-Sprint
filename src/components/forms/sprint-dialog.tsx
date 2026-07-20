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
import { Textarea } from "@/components/ui/textarea";
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
  description: string | null;
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
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        {/*
          폼 필드 state 는 이 자식(SprintForm)에 둔다. Base UI 는 닫히면 popup 하위를
          언마운트하므로(keepMounted=false), 매 열림마다 새로 마운트되어 폼이 항상
          초기값으로 리셋된다(만들기=빈 폼, 수정=원본 값).
        */}
        <SprintForm sprint={sprint} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SprintForm({
  sprint,
  onClose,
}: {
  sprint?: Existing;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [name, setName] = useState(sprint?.name ?? "");
  const [description, setDescription] = useState(sprint?.description ?? "");
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
    const payload = { name, description, status, startDate, endDate };
    start(async () => {
      try {
        if (sprint) await updateSprint(sprint.id, payload);
        else await createSprint(payload);
        toast.success(sprint ? "수정했습니다" : "스프린트를 만들었습니다");
        onClose();
        router.refresh();
      } catch {
        toast.error("저장에 실패했습니다");
      }
    });
  }

  return (
    <>
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
          <Label>설명</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="마크다운 지원 (# 제목, - 목록, **굵게**, `코드`)"
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
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </Button>
      </DialogFooter>
    </>
  );
}
