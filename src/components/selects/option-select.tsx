"use client";

import * as React from "react";
import type { Status, Priority, SprintStatus } from "@prisma/client";
import { ChevronDownIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  selectTriggerClass,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  PRIORITY_META,
  SPRINT_STATUS_META,
} from "@/lib/constants";
import type { MiniUser } from "@/components/user-badge";
import { initialsOf } from "@/components/user-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * 팀 select 옵션. 이전엔 fields.tsx / team-filter.tsx 에서 각각 정의되던 것을
 * 여기 단일 정의로 통합하고, 두 파일이 이 타입을 re-export 해서 참조를 맞춘다.
 */
export type TeamOption = {
  id: string;
  key: string;
  name: string;
  color?: string | null;
};

/**
 * 목록 맨 앞에 붙는 sentinel 옵션.
 * - 필터의 "모든 X"(선택 시 트리거엔 짧은 placeholder 표기)
 * - 폼의 "미지정"/"무소속"(선택 시 트리거에 같은 라벨 표기)
 * 를 하나의 개념으로 표현한다.
 *
 * `label`   : 드롭다운 항목에 표시되는 텍스트
 * `triggerLabel` : 이 값이 선택됐을 때 트리거에 표시할 텍스트(없으면 `label` 사용).
 *   필터는 항목("모든 상태")과 트리거("상태")가 다르므로 이 필드로 구분한다.
 */
export type LeadingOption = {
  value: string;
  label: React.ReactNode;
  triggerLabel?: React.ReactNode;
};

/**
 * 제네릭 select. `<Select>`+트리거+`<SelectValue>`(값→라벨 렌더)+항목 매핑을 한 곳에 모은다.
 *
 * 핵심: 트리거는 항상 선택된 옵션의 "렌더된 라벨"을 보여준다(원본 id/enum 노출 금지).
 * 트리거 표기가 항목과 달라야 하는 경우(예: 팀 필터는 항목엔 이름까지, 트리거엔 key만)
 * `renderTriggerOption` 으로 트리거 전용 렌더를 주면 된다. 없으면 `renderOption` 재사용.
 */
/** 이 개수 이상이면(검색 텍스트가 제공된 경우) 검색 입력을 자동으로 붙인다. */
const SEARCH_THRESHOLD = 8;

export function OptionSelect<T>({
  value,
  onValueChange,
  options,
  getValue,
  getSearchText,
  renderOption,
  renderTriggerOption,
  placeholder,
  leadingOption,
  disabled,
  triggerClassName,
  size,
  searchable,
  searchPlaceholder = "검색",
}: {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: readonly T[];
  getValue: (option: T) => string;
  /**
   * 검색 매칭용 평문(이름·이메일·키 등). 제공되면 옵션이 많을 때 검색 입력이 붙는다.
   * `renderOption` 은 ReactNode 라 텍스트 매칭에 쓸 수 없어 따로 받는다.
   */
  getSearchText?: (option: T) => string;
  renderOption: (option: T) => React.ReactNode;
  renderTriggerOption?: (option: T) => React.ReactNode;
  placeholder?: string;
  leadingOption?: LeadingOption;
  disabled?: boolean;
  triggerClassName?: string;
  size?: "sm" | "default";
  /** 검색 UI 강제 on/off. 미지정 시 `getSearchText` + 옵션 수로 자동 판단. */
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const renderTrigger = renderTriggerOption ?? renderOption;
  // 검색 텍스트가 없으면 매칭이 불가능하므로 자동 활성 대상에서 제외(안전한 기본값).
  const useSearch =
    searchable ?? (!!getSearchText && options.length >= SEARCH_THRESHOLD);

  if (useSearch) {
    return (
      <SearchableOptionSelect
        value={value}
        onValueChange={onValueChange}
        options={options}
        getValue={getValue}
        getSearchText={getSearchText}
        renderOption={renderOption}
        renderTriggerOption={renderTrigger}
        placeholder={placeholder}
        leadingOption={leadingOption}
        disabled={disabled}
        triggerClassName={triggerClassName}
        size={size}
        searchPlaceholder={searchPlaceholder}
      />
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as string)}
      disabled={disabled}
    >
      <SelectTrigger className={triggerClassName} size={size}>
        <SelectValue placeholder={placeholder}>
          {(v: string) => {
            const opt = options.find((o) => getValue(o) === v);
            if (opt) return renderTrigger(opt);
            // 선택값이 옵션에 없을 때(sentinel 선택 포함, 혹은 stale/unknown 값):
            // leadingOption 이 있으면 그 sentinel 라벨로 수렴(필터="상태", 폼="미지정"/"무소속"),
            // 없으면 placeholder 로 폴백한다. 원본 각 소비처의 not-found 동작과 일치.
            if (leadingOption) {
              return leadingOption.triggerLabel ?? leadingOption.label;
            }
            return placeholder ?? null;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {leadingOption && (
          <SelectItem value={leadingOption.value}>
            {leadingOption.label}
          </SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={getValue(o)} value={getValue(o)}>
            {renderOption(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * 검색 가능한 셀렉트(Popover + cmdk Command). `AssigneePicker` 와 같은 패턴이며,
 * 트리거는 `selectTriggerClass` 를 재사용해 Base UI Select 와 시각적으로 동일하다.
 * cmdk 는 항목의 `value` 문자열로 필터링하므로 `getSearchText` 결과를 넣는다
 * (동명이인·중복 라벨 대비로 실제 값도 함께 넣어 항목이 서로 상쇄되지 않게 한다).
 */
function SearchableOptionSelect<T>({
  value,
  onValueChange,
  options,
  getValue,
  getSearchText,
  renderOption,
  renderTriggerOption,
  placeholder,
  leadingOption,
  disabled,
  triggerClassName,
  size = "default",
  searchPlaceholder,
}: {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: readonly T[];
  getValue: (option: T) => string;
  getSearchText?: (option: T) => string;
  renderOption: (option: T) => React.ReactNode;
  renderTriggerOption: (option: T) => React.ReactNode;
  placeholder?: string;
  leadingOption?: LeadingOption;
  disabled?: boolean;
  triggerClassName?: string;
  size?: "sm" | "default";
  searchPlaceholder: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => getValue(o) === value);

  // 트리거 표기 규칙은 Select 분기와 동일: 선택 옵션 → sentinel 라벨 → placeholder.
  const triggerContent = selected
    ? renderTriggerOption(selected)
    : leadingOption
      ? (leadingOption.triggerLabel ?? leadingOption.label)
      : (placeholder ?? null);

  function choose(next: string) {
    setOpen(false);
    onValueChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            data-slot="select-trigger"
            data-size={size}
            disabled={disabled}
            className={cn(selectTriggerClass, triggerClassName)}
          >
            <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left">
              {triggerContent}
            </span>
            <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0" />
          </button>
        }
      />
      <PopoverContent align="start" className="w-(--anchor-width) min-w-56 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>결과가 없습니다</CommandEmpty>
            {leadingOption && (
              <CommandItem
                value={`${leadingOption.value} ${typeof leadingOption.label === "string" ? leadingOption.label : ""}`}
                onSelect={() => choose(leadingOption.value)}
              >
                {leadingOption.label}
              </CommandItem>
            )}
            {options.map((o) => (
              <CommandItem
                key={getValue(o)}
                value={`${getSearchText ? getSearchText(o) : ""} ${getValue(o)}`}
                onSelect={() => choose(getValue(o))}
                disabled={disabled}
              >
                {renderOption(o)}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ---------- 엔티티 렌더러 (항목·트리거 공용) ---------- */

/** 팀: 색 도트 + mono key + (옵션) muted 이름. 필터 트리거는 showName=false 로 key만 표기. */
export function renderTeamOption(
  t: TeamOption,
  opts?: { showName?: boolean },
): React.ReactNode {
  const showName = opts?.showName ?? true;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="size-2 shrink-0 rounded-full"
        style={t.color ? { backgroundColor: t.color } : undefined}
      />
      <span className="shrink-0 font-mono text-xs">{t.key}</span>
      {showName && (
        <span className="text-muted-foreground min-w-0 truncate">{t.name}</span>
      )}
    </span>
  );
}

/** 팀 트리거 전용(이름 생략): 필터에서 item 은 이름까지, 트리거는 key만 보일 때 사용. */
export function renderTeamKey(t: TeamOption): React.ReactNode {
  return renderTeamOption(t, { showName: false });
}

/** 멤버 항목: size-5 아바타 + 이름/이메일. */
export function renderMemberOption(m: MiniUser): React.ReactNode {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-5">
        {m.image && <AvatarImage src={m.image} alt={m.name ?? ""} />}
        <AvatarFallback className="text-[10px]">{initialsOf(m)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate">{memberLabel(m)}</span>
    </span>
  );
}

/** 멤버 텍스트 라벨(아바타 없음): 필터 항목/트리거, 폼 트리거의 plain 표기용. */
export function memberLabel(m: MiniUser): string {
  return m.name ?? m.email;
}

/** 상태: 색 도트 + STATUS_META 라벨. */
export function renderStatusOption(s: Status): React.ReactNode {
  return (
    <span className="flex items-center gap-2">
      <span className={`size-1.5 rounded-full ${STATUS_META[s].dot}`} />
      {STATUS_META[s].label}
    </span>
  );
}

/** 스프린트 상태: 색 도트 + SPRINT_STATUS_META 라벨(enum 이 Status 와 다르다). */
export function renderSprintStatusOption(s: SprintStatus): React.ReactNode {
  return (
    <span className="flex items-center gap-2">
      <span className={`size-1.5 rounded-full ${SPRINT_STATUS_META[s].dot}`} />
      {SPRINT_STATUS_META[s].label}
    </span>
  );
}

/** 우선순위: PRIORITY_META 색 라벨. */
export function renderPriorityOption(p: Priority): React.ReactNode {
  return <span className={PRIORITY_META[p].color}>{PRIORITY_META[p].label}</span>;
}
