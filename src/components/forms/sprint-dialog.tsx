"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SprintStatus } from "@prisma/client";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPRINT_STATUS_ORDER, SPRINT_STATUS_META } from "@/lib/constants";
import { toDateInput } from "@/components/forms/fields";
import {
  FormDialog,
  FormField,
  TitleField,
  DescriptionField,
  DateRangeFields,
  FormFooter,
} from "@/components/forms/form-dialog";
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
  return (
    <FormDialog
      trigger={trigger}
      contentClassName="sm:max-w-md"
      form={(onClose) => <SprintForm sprint={sprint} onClose={onClose} />}
    />
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
        <TitleField
          label="이름"
          value={name}
          onChange={setName}
          placeholder="예: 2026 상반기 스프린트"
        />
        <DescriptionField
          value={description}
          onChange={setDescription}
          placeholder="마크다운 지원 (# 제목, - 목록, **굵게**, `코드`)"
        />
        <FormField label="상태">
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
        </FormField>
        <DateRangeFields
          start={startDate}
          onStartChange={setStartDate}
          end={endDate}
          onEndChange={setEndDate}
        />
      </div>
      <FormFooter pending={pending} onClose={onClose} onSubmit={submit} />
    </>
  );
}
