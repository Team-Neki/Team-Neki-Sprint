"use client";

import type { Status, Priority } from "@prisma/client";
import {
  OptionSelect,
  memberLabel,
  renderMemberOption,
  renderPriorityOption,
  renderStatusOption,
  renderTeamOption,
} from "@/components/selects/option-select";
import { STATUS_ORDER, PRIORITY_ORDER } from "@/lib/constants";
import type { MiniUser } from "@/components/user-badge";
import type { TeamOption } from "@/components/selects/option-select";

// TeamOption 은 selects/option-select 로 단일화됐다. 기존 import 경로 호환을 위해 re-export.
export type { TeamOption };

const UNASSIGNED = "__none__";

export function StatusSelect({
  value,
  onChange,
}: {
  value: Status;
  onChange: (v: Status) => void;
}) {
  return (
    <OptionSelect<Status>
      value={value}
      onValueChange={(v) => onChange(v as Status)}
      options={STATUS_ORDER}
      getValue={(s) => s}
      renderOption={renderStatusOption}
      triggerClassName="w-full"
    />
  );
}

export function PrioritySelect({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (v: Priority) => void;
}) {
  return (
    <OptionSelect<Priority>
      value={value}
      onValueChange={(v) => onChange(v as Priority)}
      options={PRIORITY_ORDER}
      getValue={(p) => p}
      renderOption={renderPriorityOption}
      triggerClassName="w-full"
    />
  );
}

export function MemberSelect({
  value,
  onChange,
  members,
  placeholder = "담당자 선택",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  members: MiniUser[];
  placeholder?: string;
}) {
  return (
    <OptionSelect<MiniUser>
      value={value ?? UNASSIGNED}
      onValueChange={(v) => onChange(v === UNASSIGNED ? null : v)}
      options={members}
      getValue={(m) => m.id}
      renderOption={renderMemberOption}
      renderTriggerOption={memberLabel}
      placeholder={placeholder}
      leadingOption={{ value: UNASSIGNED, label: "미지정" }}
      triggerClassName="w-full"
    />
  );
}

/** 팀 선택 (에픽/태스크 생성 시). key 접두어 + 색 도트로 표시. */
export function TeamSelect({
  value,
  onChange,
  teams,
  placeholder = "팀 선택",
}: {
  value: string | null;
  onChange: (v: string) => void;
  teams: TeamOption[];
  placeholder?: string;
}) {
  return (
    <OptionSelect<TeamOption>
      value={value ?? undefined}
      onValueChange={(v) => {
        if (v) onChange(v);
      }}
      options={teams}
      getValue={(t) => t.id}
      renderOption={(t) => renderTeamOption(t)}
      placeholder={placeholder}
      triggerClassName="w-full"
    />
  );
}

export function GenericSelect({
  value,
  onChange,
  options,
  placeholder,
  noneLabel = "없음",
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
  noneLabel?: string;
}) {
  return (
    <OptionSelect<{ id: string; label: string }>
      value={value ?? UNASSIGNED}
      onValueChange={(v) => onChange(v === UNASSIGNED ? null : v)}
      options={options}
      getValue={(o) => o.id}
      renderOption={(o) => (
        <span className="min-w-0 truncate">{o.label}</span>
      )}
      placeholder={placeholder}
      leadingOption={{ value: UNASSIGNED, label: noneLabel }}
      triggerClassName="w-full"
    />
  );
}

/**
 * 팀이 고정된 경우(수정 모드/에픽 상속) 팀 key를 읽기 전용으로 표시.
 * 에픽·태스크 다이얼로그가 각자 복붙하던 것을 공용화(2026-07-22).
 */
export function TeamKeyReadonly({
  teams,
  teamId,
}: {
  teams: TeamOption[];
  teamId: string | null;
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

export function toDateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 10);
}
