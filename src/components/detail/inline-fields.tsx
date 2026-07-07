"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Status, Priority } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  OptionSelect,
  memberLabel,
  renderMemberOption,
  renderPriorityOption,
  renderStatusOption,
} from "@/components/selects/option-select";
import { STATUS_ORDER, PRIORITY_ORDER } from "@/lib/constants";
import type { MiniUser } from "@/components/user-badge";
import { cn } from "@/lib/utils";
import { toDateInput } from "@/components/forms/fields";
import { updateTaskFields } from "@/server/actions/tasks";
import { updateEpicFields } from "@/server/actions/epics";
import { updateProjectFields } from "@/server/actions/projects";

export type DetailEntity = "task" | "epic" | "project";

const UNASSIGNED = "__none__";
const NONE = "__none__";

// 엔티티별 단일 필드 patch 액션(diff 로깅은 서버에서 처리).
const UPDATE: Record<
  DetailEntity,
  (id: string, patch: Record<string, unknown>) => Promise<unknown>
> = {
  task: updateTaskFields,
  epic: updateEpicFields,
  project: updateProjectFields,
};

// 칩처럼 보이는 인라인 select 트리거: 보더 투명 + hover 시 인셋 면 노출(우측 정렬).
const chipTrigger =
  "h-7 gap-1 border-transparent bg-transparent px-1.5 shadow-none hover:bg-accent";

/** 상세 인라인 편집 공용 훅: patch 저장 → 서버 확정 후 router.refresh. */
function useFieldSave(type: DetailEntity, id: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function save(patch: Record<string, unknown>) {
    start(async () => {
      try {
        await UPDATE[type](id, patch);
        router.refresh();
      } catch {
        toast.error("변경에 실패했습니다");
        router.refresh();
      }
    });
  }
  return { pending, save };
}

/** 메타 카드의 한 줄: 라벨(좌) + 편집 값(우). */
export function MetaRow({
  label,
  children,
  align = "center",
}: {
  label: string;
  children: React.ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-2",
        align === "center" ? "items-center" : "items-start",
      )}
    >
      <span className="text-muted-foreground shrink-0 pt-1 text-xs">
        {label}
      </span>
      <div className="flex min-w-0 justify-end">{children}</div>
    </div>
  );
}

/* ---------- 제목(인라인 텍스트) ---------- */

export function InlineTitle({
  type,
  id,
  value,
}: {
  type: DetailEntity;
  id: string;
  value: string;
}) {
  const { pending, save } = useFieldSave(type, id);
  const [text, setText] = useState(value);
  // 서버 확정값(prop)이 바뀌면(refresh 후) 로컬 편집값을 렌더 중 동기화(effect 미사용).
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setText(value);
  }

  function commit() {
    const next = text.trim();
    if (!next) {
      setText(value); // 빈 제목 불가 — 복원
      return;
    }
    if (next !== value) save({ title: next });
  }

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setText(value);
          e.currentTarget.blur();
        }
      }}
      disabled={pending}
      aria-label="제목"
      className="focus:bg-accent/50 -mx-1.5 w-full rounded-md px-1.5 py-0.5 text-2xl font-semibold tracking-tight outline-none disabled:opacity-60"
    />
  );
}

/* ---------- 설명(인라인 textarea) ---------- */

export function InlineDescription({
  type,
  id,
  value,
}: {
  type: DetailEntity;
  id: string;
  value: string | null;
}) {
  const { pending, save } = useFieldSave(type, id);
  const v = value ?? "";
  const [text, setText] = useState(v);
  const [prev, setPrev] = useState(v);
  if (v !== prev) {
    setPrev(v);
    setText(v);
  }

  function commit() {
    if (text !== v) save({ description: text });
  }

  return (
    <Textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      disabled={pending}
      rows={3}
      placeholder="설명을 입력하세요…"
      className="border-transparent bg-transparent px-2 hover:border-input focus-visible:border-ring"
      aria-label="설명"
    />
  );
}

/* ---------- 상태 / 우선순위 ---------- */

export function InlineStatus({
  type,
  id,
  value,
}: {
  type: DetailEntity;
  id: string;
  value: Status;
}) {
  const { pending, save } = useFieldSave(type, id);
  return (
    <OptionSelect<Status>
      value={value}
      onValueChange={(v) => save({ status: v as Status })}
      options={STATUS_ORDER}
      getValue={(s) => s}
      renderOption={renderStatusOption}
      disabled={pending}
      size="sm"
      triggerClassName={chipTrigger}
    />
  );
}

export function InlinePriority({
  type,
  id,
  value,
}: {
  type: DetailEntity;
  id: string;
  value: Priority;
}) {
  const { pending, save } = useFieldSave(type, id);
  return (
    <OptionSelect<Priority>
      value={value}
      onValueChange={(v) => save({ priority: v as Priority })}
      options={PRIORITY_ORDER}
      getValue={(p) => p}
      renderOption={renderPriorityOption}
      disabled={pending}
      size="sm"
      triggerClassName={chipTrigger}
    />
  );
}

/* ---------- 담당자 / 보고자(owner·assignee) ---------- */

export function InlineMember({
  type,
  id,
  field,
  value,
  members,
  placeholder = "미지정",
}: {
  type: DetailEntity;
  id: string;
  field: "assigneeId" | "ownerId" | "reporterId";
  value: MiniUser | null;
  members: MiniUser[];
  placeholder?: string;
}) {
  const { pending, save } = useFieldSave(type, id);
  return (
    <OptionSelect<MiniUser>
      value={value?.id ?? UNASSIGNED}
      onValueChange={(v) => save({ [field]: v === UNASSIGNED ? null : v })}
      options={members}
      getValue={(m) => m.id}
      renderOption={renderMemberOption}
      renderTriggerOption={memberLabel}
      placeholder={placeholder}
      leadingOption={{ value: UNASSIGNED, label: "미지정" }}
      disabled={pending}
      size="sm"
      triggerClassName={chipTrigger}
    />
  );
}

/* ---------- 엔티티 링크(에픽/프로젝트/스프린트) ---------- */

export function InlineLink({
  type,
  id,
  field,
  value,
  options,
  noneLabel = "없음",
  placeholder = "선택",
}: {
  type: DetailEntity;
  id: string;
  field: "epicId" | "projectId" | "sprintId";
  value: string | null;
  options: { id: string; label: string }[];
  noneLabel?: string;
  placeholder?: string;
}) {
  const { pending, save } = useFieldSave(type, id);
  return (
    <OptionSelect<{ id: string; label: string }>
      value={value ?? NONE}
      onValueChange={(v) => save({ [field]: v === NONE ? null : v })}
      options={options}
      getValue={(o) => o.id}
      renderOption={(o) => o.label}
      placeholder={placeholder}
      leadingOption={{ value: NONE, label: noneLabel }}
      disabled={pending}
      size="sm"
      triggerClassName={cn(chipTrigger, "max-w-44")}
    />
  );
}

/* ---------- 날짜 ---------- */

export function InlineDate({
  type,
  id,
  field,
  value,
}: {
  type: DetailEntity;
  id: string;
  field: "startDate" | "dueDate";
  value: Date | string | null;
}) {
  const { pending, save } = useFieldSave(type, id);
  const initial = toDateInput(value);
  return (
    <Input
      type="date"
      defaultValue={initial}
      disabled={pending}
      onChange={(e) => {
        if (e.target.value !== initial) save({ [field]: e.target.value });
      }}
      className="h-7 w-[8.5rem] border-transparent bg-transparent px-1.5 text-xs hover:border-input focus-visible:border-ring"
      aria-label={field === "startDate" ? "시작일" : "기한"}
    />
  );
}

/* ---------- 숫자(스토리포인트 / MD) ---------- */

export function InlineNumber({
  type,
  id,
  field,
  value,
  step = "1",
  placeholder = "—",
  suffix,
}: {
  type: DetailEntity;
  id: string;
  field: "storyPoints" | "estimatedMd" | "actualMd";
  value: number | null;
  step?: string;
  placeholder?: string;
  suffix?: string;
}) {
  const { pending, save } = useFieldSave(type, id);
  const asStr = value != null ? String(value) : "";
  const [text, setText] = useState(asStr);
  const [prev, setPrev] = useState(asStr);
  if (asStr !== prev) {
    setPrev(asStr);
    setText(asStr);
  }

  function commit() {
    if (text === asStr) return; // 서버 값과 동일 — 저장 생략
    save({ [field]: text === "" ? null : text });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        type="number"
        min={0}
        step={step}
        value={text}
        placeholder={placeholder}
        disabled={pending}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="h-7 w-16 border-transparent bg-transparent px-1.5 text-right text-sm hover:border-input focus-visible:border-ring"
        aria-label={field}
      />
      {suffix && <span className="text-muted-foreground text-xs">{suffix}</span>}
    </span>
  );
}
