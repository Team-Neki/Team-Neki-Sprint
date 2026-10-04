"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { defaultFilter } from "cmdk";
import {
  useFieldSave,
  useOptimisticValue,
} from "@/components/detail/use-field-save";

/** `issueKey` 는 팀 접두어 key 가 있는 에픽만. 프로젝트·스프린트는 제목만 보인다. */
export type ParentOption = { id: string; title: string; issueKey?: string };

// 부모 종류 -> 이 필드를 가진 자식 엔티티·저장 컬럼·부모 상세 경로·검색 안내.
const PARENT = {
  epic: { child: "task", field: "epicId", href: "/epics", search: "에픽 제목·번호 검색" },
  project: { child: "epic", field: "projectId", href: "/projects", search: "프로젝트 제목 검색" },
  sprint: { child: "project", field: "sprintId", href: "/sprints", search: "스프린트 이름 검색" },
} as const;

/**
 * 상세의 부모 필드(태스크->에픽, 에픽->프로젝트, 프로젝트->스프린트, #3). 현재 부모는 링크
 * (클릭 시 부모 상세로 이동), "변경" 버튼은 검색 콤보박스를 열어 부모를 바꾼다.
 * 항목 value 는 고유한 id 라 제목이 같은 부모가 있어도 키보드 선택이 정확하다. 검색은
 * keywords(key·제목)로만 한다 — value(id)까지 점수에 넣으면 id 글자가 짧은 검색어에 걸린다.
 */
function filterByKeywords(_value: string, search: string, keywords?: string[]) {
  return defaultFilter("", search, keywords);
}

export function ParentField({
  parent,
  id,
  value,
  options,
}: {
  parent: keyof typeof PARENT;
  /** 자식(지금 보고 있는 상세) id. */
  id: string;
  value: string | null;
  options: ParentOption[];
}) {
  const { child, field, href, search } = PARENT[parent];
  const [open, setOpen] = useState(false);
  const { pending, save } = useFieldSave(child, id);
  const [shown, show, reset] = useOptimisticValue(value);
  const current = options.find((o) => o.id === shown) ?? null;

  function choose(next: string | null) {
    setOpen(false);
    if (next === shown) return;
    show(next);
    save({ [field]: next }, reset);
  }

  return (
    <div className="flex min-w-0 items-center justify-end gap-1">
      {current ? (
        <Link
          href={`${href}/${current.id}`}
          className="min-w-0 truncate text-sm hover:underline"
          title={current.title}
        >
          {current.issueKey && (
            <>
              <span className="text-muted-foreground font-mono text-xs">
                {current.issueKey}
              </span>{" "}
            </>
          )}
          {current.title}
        </Link>
      ) : (
        <span className="text-muted-foreground text-sm">없음</span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-1.5 text-xs"
              disabled={pending}
            >
              변경
            </Button>
          }
        />
        <PopoverContent align="end" className="w-72 p-0">
          <Command filter={filterByKeywords}>
            <CommandInput placeholder={search} />
            <CommandList>
              <CommandEmpty>결과가 없습니다</CommandEmpty>
              <CommandItem
                value="none"
                keywords={["없음", "none"]}
                onSelect={() => choose(null)}
              >
                <span className="text-muted-foreground">없음</span>
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  keywords={o.issueKey ? [o.issueKey, o.title] : [o.title]}
                  onSelect={() => choose(o.id)}
                  disabled={pending}
                >
                  {o.issueKey && (
                    <span className="text-muted-foreground shrink-0 font-mono text-xs">
                      {o.issueKey}
                    </span>
                  )}
                  <span className="truncate">{o.title}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
