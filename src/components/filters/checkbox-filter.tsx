"use client";

import type * as React from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useSetSearchParams } from "@/components/filters/use-set-search-params";

export type CheckboxFilterOption = {
  value: string;
  label: React.ReactNode;
  /** cmdk 내장 필터가 매칭할 검색어(라벨이 노드일 때 필수). 없으면 라벨 문자열을 사용. */
  keywords?: string;
};

/**
 * 검색 가능한 다중선택 체크박스 필터(F6). 단일선택 OptionSelect 를 대체해
 * URL 파라미터를 콤마구분 다중값으로 쓴다(예: `?assignee=a,b`). 팝오버+cmdk Command
 * 구조는 detail/entity-labels.tsx 의 라벨 팝오버 패턴을 따른다.
 *
 * 선택 상태는 URL(searchParams)에서 직접 읽으므로 자체 state 가 없다 — 토글은
 * router.replace 로 파라미터를 갱신하고, 값이 비면 키 자체를 지운다.
 *
 * clearable 이면 선택이 있을 때 칩 옆에 자기 파라미터만 지우는 초기화 버튼을 둔다
 * (다른 필터 값은 건드리지 않음).
 */
export function CheckboxFilter({
  paramKey,
  label,
  options,
  className,
  clearable,
}: {
  paramKey: string;
  label: string;
  options: CheckboxFilterOption[];
  className?: string;
  clearable?: boolean;
}) {
  const params = useSearchParams();
  const setParams = useSetSearchParams();

  const selected = new Set(
    (params.get(paramKey) ?? "").split(",").filter(Boolean),
  );

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setParams({ [paramKey]: [...next].join(",") });
  }

  return (
    <>
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className={className}>
              {selected.size > 0 ? `${label} · ${selected.size}` : label}
            </Button>
          }
        />
        <PopoverContent align="start" className="w-56 p-0">
          <Command>
            <CommandInput placeholder={`${label} 검색`} />
            <CommandList>
              <CommandEmpty>결과가 없습니다</CommandEmpty>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={
                    opt.keywords ??
                    (typeof opt.label === "string" ? opt.label : opt.value)
                  }
                  onSelect={() => toggle(opt.value)}
                >
                  <Checkbox
                    checked={selected.has(opt.value)}
                    className="pointer-events-none"
                  />
                  <span className="min-w-0 truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {clearable && selected.size > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setParams({ [paramKey]: "" })}
        >
          <X className="size-4" /> 초기화
        </Button>
      )}
    </>
  );
}
