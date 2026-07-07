"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
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

export type LinkItem = {
  id: string;
  /** cmdk value / 접근성 라벨 (문자열). */
  label: string;
  /** 커스텀 렌더(없으면 label 텍스트). */
  node?: ReactNode;
};

/**
 * 서버 검색 기반 연결 콤보박스. cmdk 자체 필터는 끄고(shouldFilter=false)
 * 서버 액션 결과를 그대로 노출한다. 티켓↔위키 양방향 링크 UI에서 공용으로 쓴다.
 */
export function LinkSearchPopover({
  triggerLabel = "연결",
  placeholder = "검색…",
  emptyLabel = "결과가 없습니다",
  search,
  onSelect,
  excludeIds = [],
}: {
  triggerLabel?: string;
  placeholder?: string;
  emptyLabel?: string;
  search: (query: string) => Promise<LinkItem[]>;
  onSelect: (id: string) => Promise<void>;
  excludeIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();

  // search는 부모에서 매 렌더 새 함수로 올 수 있으니 최신값을 ref로 들고
  // 있으면서(검색 effect는 query/open 변화에만 재실행), 렌더 중이 아닌
  // effect에서 갱신한다.
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // setState는 effect 본문이 아니라 지연 콜백에서 호출(cascading render 방지).
    const timer = setTimeout(() => {
      setLoading(true);
      searchRef
        .current(query)
        .then((res) => {
          if (!cancelled) setItems(res);
        })
        .catch(() => {
          if (!cancelled) setItems([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  function choose(id: string) {
    start(async () => {
      try {
        await onSelect(id);
        setOpen(false);
        setQuery("");
      } catch {
        toast.error("연결에 실패했습니다");
      }
    });
  }

  const excluded = new Set(excludeIds);
  const visible = items.filter((i) => !excluded.has(i.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button size="sm" variant="outline">
            <Plus className="size-4" /> {triggerLabel}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={placeholder}
          />
          <CommandList>
            {loading ? (
              <div className="text-muted-foreground py-6 text-center text-sm">
                검색 중…
              </div>
            ) : visible.length === 0 ? (
              <CommandEmpty>{emptyLabel}</CommandEmpty>
            ) : (
              visible.map((i) => (
                <CommandItem
                  key={i.id}
                  value={i.id}
                  onSelect={() => choose(i.id)}
                  disabled={pending}
                >
                  {i.node ?? <span className="truncate">{i.label}</span>}
                </CommandItem>
              ))
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
