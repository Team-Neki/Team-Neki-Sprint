"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Columns3, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { saveColumnPref } from "@/server/actions/column-prefs";
import {
  mergeColumnPref,
  type ColumnMeta,
  type ColumnPref,
} from "./column-registry";

type Item = { key: string; label: string; visible: boolean };

/**
 * PLP 표 컬럼 커스터마이즈 UI(F4). "컬럼" 버튼 → Popover 안 @dnd-kit sortable 목록.
 * 각 행: 드래그 핸들(GripVertical) + 노출 Checkbox + 라벨. 재정렬/토글은 즉시
 * saveColumnPref → router.refresh() 로 영속화한다(낙관적 로컬 반영 후 서버 재검증).
 * "기본값으로"는 빈 배열 저장(= 행 삭제 → 기본 컬럼 폴백)으로 초기화한다.
 */
export function ColumnSettings({
  table,
  available,
  pref,
}: {
  table: string;
  available: ColumnMeta[];
  pref: ColumnPref | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<Item[]>(() =>
    mergeColumnPref(available, pref),
  );

  // 서버가 새 pref/available 을 내려주면 로컬 목록을 재동기화(adjust state during render).
  const sig = JSON.stringify(pref) + "|" + JSON.stringify(available);
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setItems(mergeColumnPref(available, pref));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const visibleCount = items.filter((i) => i.visible).length;

  function persist(next: Item[]) {
    setItems(next);
    const payload = next.map(({ key, visible }) => ({ key, visible }));
    startTransition(async () => {
      try {
        await saveColumnPref(table, payload);
        router.refresh();
      } catch {
        toast.error("컬럼 설정 저장에 실패했습니다");
      }
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.key === active.id);
    const to = items.findIndex((i) => i.key === over.id);
    if (from < 0 || to < 0) return;
    persist(arrayMove(items, from, to));
  }

  function toggle(key: string, checked: boolean) {
    persist(items.map((i) => (i.key === key ? { ...i, visible: checked } : i)));
  }

  function reset() {
    // 빈 배열 저장 → 행 삭제 → 기본 컬럼 폴백. 로컬은 available 전체(노출)로 낙관 반영.
    setItems(available.map((c) => ({ key: c.key, label: c.label, visible: true })));
    startTransition(async () => {
      try {
        await saveColumnPref(table, []);
        router.refresh();
      } catch {
        toast.error("컬럼 설정 저장에 실패했습니다");
      }
    });
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Columns3 className="size-4" /> 컬럼
          </Button>
        }
      />
      <PopoverContent align="end" className="w-64">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">컬럼 표시·순서</span>
          <Button
            variant="ghost"
            size="xs"
            onClick={reset}
            disabled={pending}
          >
            기본값으로
          </Button>
        </div>
        <DndContext
          id={`column-settings-${table}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.key)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => (
                <SortableRow
                  key={item.key}
                  item={item}
                  disabled={pending}
                  // 마지막 남은 노출 컬럼은 끌 수 없게(빈 표 방지).
                  lockVisible={item.visible && visibleCount === 1}
                  onToggle={toggle}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </PopoverContent>
    </Popover>
  );
}

function SortableRow({
  item,
  disabled,
  lockVisible,
  onToggle,
}: {
  item: Item;
  disabled: boolean;
  lockVisible: boolean;
  onToggle: (key: string, checked: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.key });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-md px-1.5 py-1.5",
        isDragging ? "bg-accent" : "hover:bg-accent/50",
      )}
    >
      <button
        type="button"
        aria-label="드래그로 순서 변경"
        className="text-muted-foreground hover:text-foreground shrink-0 cursor-grab touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Checkbox
        checked={item.visible}
        disabled={disabled || lockVisible}
        onCheckedChange={(checked) => onToggle(item.key, checked === true)}
        aria-label={`${item.label} 열 표시`}
      />
      <span className="flex-1 truncate text-sm">{item.label}</span>
    </li>
  );
}
