"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Status, Priority } from "@prisma/client";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MiniUser } from "@/components/user-badge";
import {
  MemberSelect,
  GenericSelect,
  toDateInput,
} from "@/components/forms/fields";
import {
  FormDialog,
  FormField,
  TitleField,
  DescriptionField,
  StatusPriorityFields,
  DateRangeFields,
  FormFooter,
} from "@/components/forms/form-dialog";
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

type FormProps = {
  members: MiniUser[];
  sprints: { id: string; name: string }[];
  project?: Existing;
  defaultSprintId?: string;
};

export function ProjectDialog({
  trigger,
  ...formProps
}: FormProps & {
  trigger: React.ReactElement;
}) {
  return (
    <FormDialog
      trigger={trigger}
      form={(onClose) => <ProjectForm {...formProps} onClose={onClose} />}
    />
  );
}

function ProjectForm({
  members,
  sprints,
  project,
  defaultSprintId,
  onClose,
}: FormProps & { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<Status>(project?.status ?? "TODO");
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
        <DialogTitle>{project ? "프로젝트 수정" : "새 프로젝트"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <TitleField
          value={title}
          onChange={setTitle}
          placeholder="예: 브랜드 캠페인 리뉴얼"
        />
        <DescriptionField
          value={description}
          onChange={setDescription}
          placeholder="팀 횡단으로 진행할 작업의 목표와 배경"
        />
        <FormField label="스프린트">
          <GenericSelect
            value={sprintId}
            onChange={setSprintId}
            options={sprints.map((s) => ({ id: s.id, label: s.name }))}
            placeholder="스프린트 선택"
            noneLabel="없음"
          />
        </FormField>
        <StatusPriorityFields
          status={status}
          onStatusChange={setStatus}
          priority={priority}
          onPriorityChange={setPriority}
        />
        <FormField label="담당자">
          <MemberSelect value={ownerId} onChange={setOwnerId} members={members} />
        </FormField>
        <DateRangeFields
          start={startDate}
          onStartChange={setStartDate}
          end={dueDate}
          onEndChange={setDueDate}
        />
      </div>
      <FormFooter pending={pending} onClose={onClose} onSubmit={submit} />
    </>
  );
}
