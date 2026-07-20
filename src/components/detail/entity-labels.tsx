"use client";

import { useOptimistic, useState, useTransition } from "react";
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
import { cn } from "@/lib/utils";
import { createLabel } from "@/server/actions/labels";

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
 * 엔티티(태스크/프로젝트 등)의 라벨 편집 공용 UI(C8). 붙은 라벨을 배지로 보여주고(X 제거),
 * 팝오버에서 기존 라벨 토글 추가/제거 + 즉석 새 라벨 생성. 부여/해제는 엔티티별 서버 액션을
 * `attach`/`detach` 로 주입받아 재사용한다(TaskLabels·ProjectLabels 래퍼). useTransition +
 * router.refresh 로 서버 확정 후 재조회.
 */
export function EntityLabels({
  labels,
  allLabels,
  attach,
  detach,
  align = "end",
  layout = "wrap",
}: {
  labels: LabelItem[];
  allLabels: LabelItem[];
  attach: (labelId: string) => Promise<unknown>;
  detach: (labelId: string) => Promise<unknown>;
  /** 배지 정렬. 상세 시트 메타행은 우측("end"), 표 셀은 헤더와 맞춰 좌측("start"). */
  align?: "start" | "end";
  /**
   * 배치 방식(F5). 기본 "wrap"(상세 시트: 배지가 여러 줄로 줄바꿈).
   * "row"(표 셀): 한 줄 고정 — 배지는 넘치면 클리핑되고 추가 버튼은 항상 우측에 남아
   * 라벨을 추가해도 행 높이가 두꺼워지지 않는다(전체 목록/편집은 팝오버에서).
   */
  layout?: "wrap" | "row";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);

  // 낙관적 라벨 목록: 서버 왕복(router.refresh) 전에 배지를 즉시 붙이고/떼어
  // 체감 지연을 없앤다. refresh 로 새 props(labels)가 오면 자동으로 재동기화된다.
  const [optimisticLabels, applyOptimistic] = useOptimistic(
    labels,
    (state, action: { type: "add" | "remove"; label: LabelItem }) =>
      action.type === "remove"
        ? state.filter((l) => l.id !== action.label.id)
        : state.some((l) => l.id === action.label.id)
          ? state
          : [...state, action.label],
  );

  const selected = new Set(optimisticLabels.map((l) => l.id));

  function toggle(label: LabelItem) {
    const attaching = !selected.has(label.id);
    start(async () => {
      applyOptimistic({ type: attaching ? "add" : "remove", label });
      try {
        if (attaching) {
          await attach(label.id);
        } else {
          await detach(label.id);
        }
        router.refresh();
      } catch {
        toast.error("변경에 실패했습니다");
      }
    });
  }

  function remove(label: LabelItem) {
    start(async () => {
      applyOptimistic({ type: "remove", label });
      try {
        await detach(label.id);
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
        applyOptimistic({ type: "add", label });
        await attach(label.id);
        setNewName("");
        setCreating(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "생성에 실패했습니다");
      }
    });
  }

  const badges = optimisticLabels.map((l) => (
    <LabelBadge
      key={l.id}
      name={l.name}
      color={l.color}
      onRemove={pending ? undefined : () => remove(l)}
    />
  ));

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1.5",
        // row: 한 줄 고정(줄바꿈 없음), wrap: 여러 줄 허용.
        layout === "row" ? "" : "flex-wrap",
        align === "end" ? "justify-end" : "justify-start",
      )}
    >
      {layout === "row" ? (
        // 배지는 한 줄에서 넘치면 클리핑([&>*]:shrink-0 로 배지 자체는 안 찌그러짐).
        // 추가 버튼은 이 스트립 밖(shrink-0)이라 항상 보인다 → 행 높이 일정.
        <div className="flex min-w-0 items-center gap-1 overflow-hidden [&>*]:shrink-0">
          {badges}
        </div>
      ) : (
        badges
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 px-1.5 text-xs"
              disabled={pending}
              aria-label="라벨 추가"
            >
              <Tag className="size-3.5" />
              {layout !== "row" && <span className="ml-1">라벨</span>}
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
