"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { AssigneeBadge } from "@/components/assignee-badge";
import type { MiniUser } from "@/components/user-badge";
import {
  renderMemberOption,
  renderTeamOption,
  type TeamOption,
} from "@/components/selects/option-select";
import { cn } from "@/lib/utils";

/** 담당자 값: 유저 담당자 · 팀 담당자 · 미지정 중 하나(상호배타). */
export type AssigneeValue =
  | { kind: "user"; id: string }
  | { kind: "team"; id: string }
  | null;

// 칩처럼 보이는 트리거(인라인 필드의 chipTrigger 와 동일 룩).
const chipTrigger =
  "h-7 gap-1 border-transparent bg-transparent px-1.5 shadow-none hover:bg-accent";

/**
 * 검색 가능한 담당자 콤보박스(B5). 사람 + 팀을 한 팝오버에서 검색해 고른다.
 * epic-field.tsx 의 Popover + cmdk Command 패턴을 따르며, 각 항목 value 에
 * 이름/이메일/키를 넣어 cmdk 기본 필터가 셋 다로 매칭하게 한다.
 */
export function AssigneePicker({
  value,
  members,
  teams,
  onChange,
  disabled,
  triggerClassName,
  avatarOnly = false,
}: {
  value: AssigneeValue;
  members: MiniUser[];
  teams: TeamOption[];
  onChange: (next: AssigneeValue) => void;
  disabled?: boolean;
  triggerClassName?: string;
  /** 목록 셀 등 좁은 곳: 트리거를 이름 대신 아바타/키로 컴팩트하게. */
  avatarOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const currentUser =
    value?.kind === "user"
      ? (members.find((m) => m.id === value.id) ?? null)
      : null;
  const currentTeam =
    value?.kind === "team"
      ? (teams.find((t) => t.id === value.id) ?? null)
      : null;

  function choose(next: AssigneeValue) {
    setOpen(false);
    onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn(chipTrigger, triggerClassName)}
            disabled={disabled}
          >
            <AssigneeBadge
              user={currentUser}
              team={currentTeam}
              hideName={avatarOnly}
              size="xs"
            />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="담당자 검색" />
          <CommandList>
            <CommandEmpty>결과가 없습니다</CommandEmpty>
            <CommandItem value="none 미지정" onSelect={() => choose(null)}>
              <span className="text-muted-foreground">미지정</span>
            </CommandItem>
            {teams.length > 0 && (
              <CommandGroup heading="팀">
                {teams.map((t) => (
                  <CommandItem
                    key={t.id}
                    value={`team ${t.key} ${t.name}`}
                    onSelect={() => choose({ kind: "team", id: t.id })}
                    disabled={disabled}
                  >
                    {renderTeamOption(t)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {members.length > 0 && (
              <CommandGroup heading="멤버">
                {members.map((m) => (
                  <CommandItem
                    key={m.id}
                    value={`member ${m.name ?? ""} ${m.email}`}
                    onSelect={() => choose({ kind: "user", id: m.id })}
                    disabled={disabled}
                  >
                    {renderMemberOption(m)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
