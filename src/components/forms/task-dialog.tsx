"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Status, Priority } from "@prisma/client";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MiniUser } from "@/components/user-badge";
import {
  GenericSelect,
  TeamSelect,
  TeamKeyReadonly,
  type TeamOption,
  toDateInput,
} from "@/components/forms/fields";
import {
  FormDialog,
  FormField,
  FormRow,
  TitleField,
  DescriptionField,
  StatusPriorityFields,
  DateRangeFields,
  FormFooter,
} from "@/components/forms/form-dialog";
import {
  AssigneePicker,
  type AssigneeValue,
} from "@/components/selects/assignee-picker";
import { createTask, updateTask } from "@/server/actions/tasks";

type Existing = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  assigneeId: string | null;
  assigneeTeamId?: string | null;
  teamId: string;
  epicId: string | null;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  estimatedMd: number | null;
  actualMd: number | null;
};

export type TaskEpicOption = { id: string; title: string; teamId: string };

type FormProps = {
  members: MiniUser[];
  teams: TeamOption[];
  epics: TaskEpicOption[];
  task?: Existing;
  defaultEpicId?: string;
  defaultTeamId?: string;
  defaultStatus?: Status;
};

export function TaskDialog({
  trigger,
  ...formProps
}: FormProps & {
  trigger: React.ReactElement;
}) {
  return (
    <FormDialog
      trigger={trigger}
      form={(onClose) => <TaskForm {...formProps} onClose={onClose} />}
    />
  );
}

function TaskForm({
  members,
  teams,
  epics,
  task,
  defaultEpicId,
  defaultTeamId,
  defaultStatus,
  onClose,
}: FormProps & { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const isEdit = !!task;

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<Status>(
    task?.status ?? defaultStatus ?? "TODO",
  );
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "MEDIUM");
  // 담당자는 유저 또는 팀 중 하나(상호배타). 편집 진입 시 기존 값에서 종류를 판별.
  const [assignee, setAssignee] = useState<AssigneeValue>(
    task?.assigneeId
      ? { kind: "user", id: task.assigneeId }
      : task?.assigneeTeamId
        ? { kind: "team", id: task.assigneeTeamId }
        : null,
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
      assigneeId: assignee?.kind === "user" ? assignee.id : null,
      assigneeTeamId: assignee?.kind === "team" ? assignee.id : null,
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
        <DialogTitle>{task ? "태스크 수정" : "새 태스크"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <TitleField
          value={title}
          onChange={setTitle}
          placeholder="예: 히어로 배너 카피 작성"
        />
        <DescriptionField value={description} onChange={setDescription} />
        <FormRow>
          <FormField label="상위 에픽">
            <GenericSelect
              value={epicId}
              onChange={onEpicChange}
              options={epics.map((e) => ({ id: e.id, label: e.title }))}
              placeholder="에픽 선택"
              noneLabel="없음"
            />
          </FormField>
          <FormField
            label={
              <>
                소유 팀
                {isEdit ? " (변경 불가)" : epicTeamId ? " (에픽 상속)" : ""}
              </>
            }
          >
            {isEdit || epicTeamId ? (
              <TeamKeyReadonly teams={teams} teamId={effectiveTeamId} />
            ) : (
              <TeamSelect value={teamId} onChange={setTeamId} teams={teams} />
            )}
          </FormField>
        </FormRow>
        <StatusPriorityFields
          status={status}
          onStatusChange={setStatus}
          priority={priority}
          onPriorityChange={setPriority}
        />
        <FormRow>
          <FormField label="담당자">
            <AssigneePicker
              value={assignee}
              members={members}
              teams={teams}
              onChange={setAssignee}
              triggerClassName="h-9 w-full justify-start border-input"
            />
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="예상 MD">
            <Input
              type="number"
              min={0}
              step={0.5}
              value={estimatedMd}
              onChange={(e) => setEstimatedMd(e.target.value)}
              placeholder="예: 2"
            />
          </FormField>
          <FormField label="실제 MD">
            <Input
              type="number"
              min={0}
              step={0.5}
              value={actualMd}
              onChange={(e) => setActualMd(e.target.value)}
              placeholder="예: 1.5"
            />
          </FormField>
        </FormRow>
        <DateRangeFields
          start={startDate}
          onStartChange={setStartDate}
          end={dueDate}
          onEndChange={setDueDate}
          endLabel="마감일"
        />
      </div>
      <FormFooter pending={pending} onClose={onClose} onSubmit={submit} />
    </>
  );
}
