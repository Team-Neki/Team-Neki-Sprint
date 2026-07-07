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
        <SelectValue />
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
        <SelectValue />
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
        <SelectValue placeholder={placeholder} />
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
        <SelectValue placeholder={placeholder} />
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
