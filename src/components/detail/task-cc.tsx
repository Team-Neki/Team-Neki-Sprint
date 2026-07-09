"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
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
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { setTaskCc } from "@/server/actions/tasks";

/**
 * 티켓 참조(c.c.) 편집 UI. 현재 참조자를 칩으로 보여주고(X 제거), 팝오버에서 멤버를
 * 토글해 추가/제거한다. 서버 액션은 전체 집합(set)을 교체하므로, 낙관적 목록을
 * 기준으로 다음 id 배열을 만들어 넘긴다. useTransition + router.refresh 로 재동기화.
 */
export function TaskCc({
  taskId,
  value,
  members,
}: {
  taskId: string;
  value: MiniUser[];
  members: MiniUser[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [optimistic, apply] = useOptimistic(
    value,
    (state, action: { type: "add" | "remove"; user: MiniUser }) =>
      action.type === "remove"
        ? state.filter((u) => u.id !== action.user.id)
        : state.some((u) => u.id === action.user.id)
          ? state
          : [...state, action.user],
  );

  const selected = new Set(optimistic.map((u) => u.id));

  function change(user: MiniUser, adding: boolean) {
    const nextIds = adding
      ? [...selected, user.id]
      : [...selected].filter((id) => id !== user.id);
    start(async () => {
      apply({ type: adding ? "add" : "remove", user });
      try {
        await setTaskCc(taskId, nextIds);
        router.refresh();
      } catch {
        toast.error("참조 변경에 실패했습니다");
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
      {optimistic.map((u) => (
        <span
          key={u.id}
          className="bg-muted inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-1.5 text-xs"
        >
          <UserBadge user={u} size="xs" />
          <button
            type="button"
            onClick={() => change(u, false)}
            disabled={pending}
            aria-label="참조 제거"
            className="text-muted-foreground hover:text-foreground rounded-full"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-1.5 text-xs"
              disabled={pending}
            >
              <UserPlus className="size-3.5" /> 참조
            </Button>
          }
        />
        <PopoverContent align="end" className="w-64 p-0">
          <Command>
            <CommandInput placeholder="사용자 검색" />
            <CommandList>
              <CommandEmpty>사용자가 없습니다</CommandEmpty>
              {members.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.name ?? ""} ${m.email}`}
                  data-checked={selected.has(m.id)}
                  onSelect={() => change(m, !selected.has(m.id))}
                  disabled={pending}
                >
                  <UserBadge user={m} size="xs" />
                  <span className="text-muted-foreground ml-auto truncate text-xs">
                    {m.email}
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
