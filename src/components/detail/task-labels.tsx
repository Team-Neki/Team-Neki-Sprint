"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { LabelBadge } from "@/components/badges";
import {
  addLabelToTask,
  removeLabelFromTask,
  createLabel,
} from "@/server/actions/labels";

export type LabelItem = { id: string; name: string; color: string };

// 새 라벨 색 팔레트(in-product 태그 예외). team-dialog 와 동일 계열.
const COLORS = [
  "#8b5cf6",
  "#0070f3",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#ef4444",
  "#64748b",
];

/**
 * 태스크 상세의 라벨 필드(C8). 현재 붙은 라벨을 배지로 보여주고(각 배지의 X 로 제거),
 * "라벨" 팝오버에서 기존 라벨을 체크 토글로 추가/제거한다. 팝오버 하단의
 * "새 라벨 만들기"로 이름+색을 즉석 생성해 곧바로 이 태스크에 붙인다.
 * 다른 인라인 필드처럼 useTransition + router.refresh 로 서버 확정 후 재조회.
 */
export function TaskLabels({
  taskId,
  labels,
  allLabels,
}: {
  taskId: string;
  labels: LabelItem[];
  allLabels: LabelItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);

  const selected = new Set(labels.map((l) => l.id));

  function toggle(label: LabelItem) {
    start(async () => {
      try {
        if (selected.has(label.id)) {
          await removeLabelFromTask(taskId, label.id);
        } else {
          await addLabelToTask(taskId, label.id);
        }
        router.refresh();
      } catch {
        toast.error("변경에 실패했습니다");
      }
    });
  }

  function remove(labelId: string) {
    start(async () => {
      try {
        await removeLabelFromTask(taskId, labelId);
        router.refresh();
      } catch {
        toast.error("제거에 실패했습니다");
      }
    });
  }

  function createAndAttach() {
    const name = newName.trim();
    if (!name) {
      toast.error("이름을 입력하세요");
      return;
    }
    start(async () => {
      try {
        const label = await createLabel({ name, color: newColor });
        await addLabelToTask(taskId, label.id);
        setNewName("");
        setCreating(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "생성에 실패했습니다");
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
      {labels.map((l) => (
        <LabelBadge
          key={l.id}
          name={l.name}
          color={l.color}
          onRemove={pending ? undefined : () => remove(l.id)}
        />
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
              <Tag className="size-3.5" /> 라벨
            </Button>
          }
        />
        <PopoverContent align="end" className="w-64 p-0">
          <Command>
            <CommandInput placeholder="라벨 검색" />
            <CommandList>
              <CommandEmpty>라벨이 없습니다</CommandEmpty>
              {allLabels.map((l) => (
                <CommandItem
                  key={l.id}
                  value={l.name}
                  data-checked={selected.has(l.id)}
                  onSelect={() => toggle(l)}
                  disabled={pending}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="truncate">{l.name}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>

          <div className="border-t p-2">
            {creating ? (
              <div className="flex flex-col gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="새 라벨 이름"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      createAndAttach();
                    }
                  }}
                  className="h-8"
                />
                <div className="flex flex-wrap gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      aria-label={`색상 ${c}`}
                      className={
                        "size-5 rounded-full ring-offset-1 transition-shadow" +
                        (newColor === c ? " ring-primary ring-2" : "")
                      }
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex justify-end gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreating(false)}
                    disabled={pending}
                  >
                    취소
                  </Button>
                  <Button size="sm" onClick={createAndAttach} disabled={pending}>
                    만들기
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => setCreating(true)}
                disabled={pending}
              >
                <Plus className="size-3.5" /> 새 라벨 만들기
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
