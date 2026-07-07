"use client";

import type * as React from "react";
import type { Status, Priority } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_META, PRIORITY_META } from "@/lib/constants";
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
export function OptionSelect<T>({
  value,
  onValueChange,
  options,
  getValue,
  renderOption,
  renderTriggerOption,
  placeholder,
  leadingOption,
  disabled,
  triggerClassName,
  size,
}: {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: readonly T[];
  getValue: (option: T) => string;
  renderOption: (option: T) => React.ReactNode;
  renderTriggerOption?: (option: T) => React.ReactNode;
  placeholder?: string;
  leadingOption?: LeadingOption;
  disabled?: boolean;
  triggerClassName?: string;
  size?: "sm" | "default";
}) {
  const renderTrigger = renderTriggerOption ?? renderOption;
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

/* ---------- 엔티티 렌더러 (항목·트리거 공용) ---------- */

/** 팀: 색 도트 + mono key + (옵션) muted 이름. 필터 트리거는 showName=false 로 key만 표기. */
export function renderTeamOption(
  t: TeamOption,
  opts?: { showName?: boolean },
): React.ReactNode {
  const showName = opts?.showName ?? true;
  return (
    <span className="flex items-center gap-2">
      <span
        className="size-2 shrink-0 rounded-full"
        style={t.color ? { backgroundColor: t.color } : undefined}
      />
      <span className="font-mono text-xs">{t.key}</span>
      {showName && <span className="text-muted-foreground">{t.name}</span>}
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
    <span className="flex items-center gap-2">
      <Avatar className="size-5">
        {m.image && <AvatarImage src={m.image} alt={m.name ?? ""} />}
        <AvatarFallback className="text-[10px]">{initialsOf(m)}</AvatarFallback>
      </Avatar>
      {memberLabel(m)}
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

/** 우선순위: PRIORITY_META 색 라벨. */
export function renderPriorityOption(p: Priority): React.ReactNode {
  return <span className={PRIORITY_META[p].color}>{PRIORITY_META[p].label}</span>;
}
