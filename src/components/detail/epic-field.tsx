"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
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
import { formatIssueKey } from "@/lib/constants";
import { updateTaskFields } from "@/server/actions/tasks";

export type EpicPickOption = {
  id: string;
  title: string;
  number: number;
  teamKey: string | null;
};

/**
 * 태스크 상세의 에픽 필드(#3). 현재 에픽은 링크(클릭 시 해당 에픽으로 이동),
 * "변경" 버튼은 검색 콤보박스를 열어 제목·번호(키)로 조회해 에픽을 바꾼다.
 * cmdk 기본 필터를 쓰며, 각 항목 value 에 키·번호·제목을 넣어 셋 다로 검색된다.
 */
export function EpicField({
  taskId,
  epicId,
  epics,
}: {
  taskId: string;
  epicId: string | null;
  epics: EpicPickOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const current = epics.find((e) => e.id === epicId) ?? null;

  function choose(next: string | null) {
    setOpen(false);
    if (next === epicId) return;
    start(async () => {
      try {
        await updateTaskFields(taskId, { epicId: next });
        router.refresh();
      } catch {
        toast.error("변경에 실패했습니다");
      }
    });
  }

  return (
    <div className="flex min-w-0 items-center justify-end gap-1">
      {current ? (
        <Link
          href={`/epics/${current.id}`}
          className="min-w-0 truncate text-sm hover:underline"
          title={current.title}
        >
          <span className="text-muted-foreground font-mono text-xs">
            {formatIssueKey(current.teamKey, current.number)}
          </span>{" "}
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
          <Command>
            <CommandInput placeholder="에픽 제목·번호 검색" />
            <CommandList>
              <CommandEmpty>결과가 없습니다</CommandEmpty>
              <CommandItem value="none 없음" onSelect={() => choose(null)}>
                <span className="text-muted-foreground">없음</span>
              </CommandItem>
              {epics.map((e) => (
                <CommandItem
                  key={e.id}
                  value={`${formatIssueKey(e.teamKey, e.number)} ${e.number} ${e.title}`}
                  onSelect={() => choose(e.id)}
                  disabled={pending}
                >
                  <span className="text-muted-foreground shrink-0 font-mono text-xs">
                    {formatIssueKey(e.teamKey, e.number)}
                  </span>
                  <span className="truncate">{e.title}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
