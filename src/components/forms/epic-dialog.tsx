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
};

export function EpicDialog({
  trigger,
  ...formProps
}: FormProps & {
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        {/*
          폼 필드 state 는 이 자식(EpicForm)에 둔다. Base UI 는 닫히면 popup 하위를
          언마운트하므로(keepMounted=false), 매 열림마다 새로 마운트되어 폼이 항상
          초기값으로 리셋된다(만들기=빈 폼, 수정=원본 값).
        */}
        <EpicForm {...formProps} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EpicForm({
  members,
  teams,
  projects,
  epic,
  defaultProjectId,
  defaultTeamId,
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

  return (
    <>
      <DialogHeader>
        <DialogTitle>{epic ? "에픽 수정" : "새 에픽"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label>제목</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 랜딩 페이지 리뉴얼"
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
            <Label>소유 팀{isEdit && " (변경 불가)"}</Label>
            {isEdit ? (
              <TeamKeyReadonly teams={teams} teamId={epic!.teamId} />
            ) : (
              <TeamSelect value={teamId} onChange={setTeamId} teams={teams} />
            )}
          </div>
          <div className="grid gap-2">
            <Label>프로젝트</Label>
            <GenericSelect
              value={projectId}
              onChange={setProjectId}
              options={projects.map((p) => ({ id: p.id, label: p.title }))}
              placeholder="프로젝트 선택"
              noneLabel="없음"
            />
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

/** 수정 모드에서 팀은 불변 — 현재 팀 key를 읽기 전용으로 표시. */
function TeamKeyReadonly({
  teams,
  teamId,
}: {
  teams: TeamOption[];
  teamId: string;
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
