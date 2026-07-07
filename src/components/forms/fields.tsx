"use client";

import type { Status, Priority } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_ORDER, STATUS_META, PRIORITY_ORDER, PRIORITY_META } from "@/lib/constants";
import type { MiniUser } from "@/components/user-badge";
import { initialsOf } from "@/components/user-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const UNASSIGNED = "__none__";

export function StatusSelect({
  value,
  onChange,
}: {
  value: Status;
  onChange: (v: Status) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Status)}>
      <SelectTrigger>
        <SelectValue>
          {(v: Status) => (
            <span className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${STATUS_META[v].dot}`} />
              {STATUS_META[v].label}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_ORDER.map((s) => (
          <SelectItem key={s} value={s}>
            <span className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${STATUS_META[s].dot}`} />
              {STATUS_META[s].label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
    <Select value={value} onValueChange={(v) => onChange(v as Priority)}>
      <SelectTrigger>
        <SelectValue>
          {(v: Priority) => (
            <span className={PRIORITY_META[v].color}>{PRIORITY_META[v].label}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PRIORITY_ORDER.map((p) => (
          <SelectItem key={p} value={p}>
            <span className={PRIORITY_META[p].color}>{PRIORITY_META[p].label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
    <Select
      value={value ?? UNASSIGNED}
      onValueChange={(v) => onChange(v === UNASSIGNED ? null : v)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {(v: string) => {
            if (!v || v === UNASSIGNED) return "미지정";
            const m = members.find((x) => x.id === v);
            return m ? (m.name ?? m.email) : "미지정";
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>미지정</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            <span className="flex items-center gap-2">
              <Avatar className="size-5">
                {m.image && <AvatarImage src={m.image} alt={m.name ?? ""} />}
                <AvatarFallback className="text-[10px]">
                  {initialsOf(m)}
                </AvatarFallback>
              </Avatar>
              {m.name ?? m.email}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type TeamOption = {
  id: string;
  key: string;
  name: string;
  color?: string | null;
};

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
    <Select
      value={value ?? undefined}
      onValueChange={(v) => {
        if (v) onChange(v);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {(v: string) => {
            const t = teams.find((x) => x.id === v);
            if (!t) return placeholder;
            return (
              <span className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={t.color ? { backgroundColor: t.color } : undefined}
                />
                <span className="font-mono text-xs">{t.key}</span>
                <span className="text-muted-foreground">{t.name}</span>
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {teams.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <span className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={t.color ? { backgroundColor: t.color } : undefined}
              />
              <span className="font-mono text-xs">{t.key}</span>
              <span className="text-muted-foreground">{t.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
    <Select
      value={value ?? UNASSIGNED}
      onValueChange={(v) => onChange(v === UNASSIGNED ? null : v)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {(v: string) => {
            if (!v || v === UNASSIGNED) return noneLabel;
            return options.find((o) => o.id === v)?.label ?? noneLabel;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>{noneLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function toDateInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 10);
}
