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
  TeamSelect,
  TeamKeyReadonly,
  type TeamOption,
  toDateInput,
} from "@/components/forms/fields";
import {
  FormDialog,
  FormField,
  FormRow,
  QuickFillButton,
  TitleField,
  DescriptionField,
  StatusPriorityFields,
  DateRangeFields,
  FormFooter,
} from "@/components/forms/form-dialog";
import { createEpic, updateEpic } from "@/server/actions/epics";

type Existing = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  ownerId: string | null;
  teamId: string;
  projectId: string | null;
  startDate: Date | string | null;
  dueDate: Date | string | null;
};

type FormProps = {
  members: MiniUser[];
  teams: TeamOption[];
  projects: { id: string; title: string }[];
  epic?: Existing;
  defaultProjectId?: string;
  defaultTeamId?: string;
  /** 현재 로그인 사용자(퀵필 버튼용). 없으면 버튼을 렌더하지 않는다. */
  me?: { id: string; teamId: string | null } | null;
};

export function EpicDialog({
  trigger,
  ...formProps
}: FormProps & {
  trigger: React.ReactElement;
}) {
  return (
    <FormDialog
      trigger={trigger}
      form={(onClose) => <EpicForm {...formProps} onClose={onClose} />}
    />
  );
}

function EpicForm({
  members,
  teams,
  projects,
  epic,
  defaultProjectId,
  defaultTeamId,
  me,
  onClose,
}: FormProps & { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [title, setTitle] = useState(epic?.title ?? "");
  const [description, setDescription] = useState(epic?.description ?? "");
  const [status, setStatus] = useState<Status>(epic?.status ?? "TODO");
  const [priority, setPriority] = useState<Priority>(epic?.priority ?? "MEDIUM");
  const [ownerId, setOwnerId] = useState<string | null>(epic?.ownerId ?? null);
  const [teamId, setTeamId] = useState<string | null>(
    epic?.teamId ?? defaultTeamId ?? null,
  );
  const [projectId, setProjectId] = useState<string | null>(
    epic?.projectId ?? defaultProjectId ?? null,
  );
  const [startDate, setStartDate] = useState(toDateInput(epic?.startDate));
  const [dueDate, setDueDate] = useState(toDateInput(epic?.dueDate));

  const isEdit = !!epic;
  // 내 소속 팀(퀵필 '나의 팀'). 팀 미배정이면 null 이라 버튼을 렌더하지 않는다.
  const myTeamId = me?.teamId ?? null;

  function submit() {
    if (!title.trim()) {
      toast.error("제목을 입력하세요");
      return;
    }
    if (!isEdit && !teamId) {
      toast.error("팀을 선택하세요");
      return;
    }
    const payload = {
      title,
      description,
      status,
      priority,
      ownerId,
      teamId: teamId ?? epic?.teamId,
      projectId,
      startDate,
      dueDate,
    };
    start(async () => {
      try {
        if (epic) await updateEpic(epic.id, payload);
        else await createEpic(payload);
        toast.success(epic ? "수정했습니다" : "에픽을 만들었습니다");
        onClose();
        router.refresh();
      } catch {
        toast.error("저장에 실패했습니다");
      }
    });
  }

  // ⌘/Ctrl+Enter 로 저장(설명 Textarea 안에서도 동작하도록 폼 전체에서 캡처).
  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !pending) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{epic ? "에픽 수정" : "새 에픽"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-2" onKeyDown={onKeyDown}>
        <TitleField
          value={title}
          onChange={setTitle}
          placeholder="예: 랜딩 페이지 리뉴얼"
        />
        <DescriptionField value={description} onChange={setDescription} />
        <FormRow>
          <FormField
            label={<>소유 팀{isEdit && " (변경 불가)"}</>}
            // 팀은 생성 시에만 바꿀 수 있고, 내 소속 팀이 있고 아직 그 팀이 아닐 때만 노출.
            action={
              !isEdit && myTeamId && teamId !== myTeamId ? (
                <QuickFillButton onClick={() => setTeamId(myTeamId)}>
                  나의 팀
                </QuickFillButton>
              ) : null
            }
          >
            {isEdit ? (
              <TeamKeyReadonly teams={teams} teamId={epic!.teamId} />
            ) : (
              <TeamSelect value={teamId} onChange={setTeamId} teams={teams} />
            )}
          </FormField>
          <FormField label="프로젝트">
            <GenericSelect
              value={projectId}
              onChange={setProjectId}
              options={projects.map((p) => ({ id: p.id, label: p.title }))}
              placeholder="프로젝트 선택"
              noneLabel="없음"
            />
          </FormField>
        </FormRow>
        <StatusPriorityFields
          status={status}
          onStatusChange={setStatus}
          priority={priority}
          onPriorityChange={setPriority}
        />
        <FormField
          label="담당자"
          action={
            me && ownerId !== me.id ? (
              <QuickFillButton onClick={() => setOwnerId(me.id)}>
                나에게 할당
              </QuickFillButton>
            ) : null
          }
        >
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
