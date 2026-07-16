"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { RotateCcw, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  restoreWikiPage,
  purgeWikiPages,
  emptyWikiTrash,
} from "@/server/actions/wiki";

export type TrashItem = {
  id: string;
  title: string;
  deletedAt: Date;
  editor: MiniUser | null;
  descendantCount: number;
};

export function TrashList({ items }: { items: TrashItem[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  // 현재 목록에 없는 id 는 무시(새로고침으로 사라진 항목 정리).
  const validSelected = useMemo(() => {
    const ids = new Set(items.map((i) => i.id));
    return [...selectedIds].filter((id) => ids.has(id));
  }, [selectedIds, items]);

  const selectedCount = validSelected.length;
  const allSelected = items.length > 0 && selectedCount === items.length;

  function toggle(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(items.map((i) => i.id)) : new Set());
  }

  // 선택된 루트들의 하위 포함 총 삭제 예상 개수(경고 문구용).
  const affectedCount = useMemo(() => {
    const set = new Set(validSelected);
    return items
      .filter((i) => set.has(i.id))
      .reduce((sum, i) => sum + 1 + i.descendantCount, 0);
  }, [validSelected, items]);

  // 삭제 확인·토스트·router.refresh 는 ConfirmDelete 가 담당한다. 여기서는 서버
  // 액션만 호출하고(성공 시) 선택 상태만 비운다.
  async function bulkPurge() {
    await purgeWikiPages({ ids: validSelected });
    setSelectedIds(new Set());
  }

  async function emptyTrash() {
    await emptyWikiTrash();
    setSelectedIds(new Set());
  }

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <Trash2 className="size-8 opacity-40" />
        <p className="text-sm">휴지통이 비어 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => toggleAll(checked)}
            aria-label="전체 선택"
          />
          전체 선택
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmEmpty(true)}
          >
            <Trash2 className="size-4" /> 휴지통 비우기
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmBulk(true)}
            disabled={selectedCount === 0}
          >
            선택 삭제{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </Button>
        </div>
      </div>

      <ul className="divide-border divide-y rounded-lg border">
        {items.map((item) => (
          <TrashRow
            key={item.id}
            item={item}
            selected={validSelected.includes(item.id)}
            onToggle={toggle}
          />
        ))}
      </ul>

      <ConfirmDelete
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        onConfirm={bulkPurge}
        title="선택한 페이지를 영구 삭제할까요?"
        description={`선택한 ${selectedCount}개(하위 포함 총 ${affectedCount}개) 페이지와 모든 버전·댓글이 영구 삭제됩니다. 되돌릴 수 없습니다.`}
      />
      <ConfirmDelete
        open={confirmEmpty}
        onOpenChange={setConfirmEmpty}
        onConfirm={emptyTrash}
        title="휴지통을 비울까요?"
        description="휴지통의 모든 페이지와 하위·버전·댓글이 영구 삭제됩니다. 되돌릴 수 없습니다. (관리자가 아니라면 본인이 삭제한 페이지만 비워집니다.)"
      />
    </div>
  );
}

function TrashRow({
  item,
  selected,
  onToggle,
}: {
  item: TrashItem;
  selected: boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function restore() {
    start(async () => {
      try {
        await restoreWikiPage(item.id);
        toast.success("복원했습니다");
        router.refresh();
      } catch {
        toast.error("복원에 실패했습니다");
      }
    });
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Checkbox
        checked={selected}
        onCheckedChange={(checked) => onToggle(item.id, checked)}
        disabled={pending}
        aria-label={`${item.title || "제목 없음"} 선택`}
      />
      <FileText className="text-muted-foreground size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {item.title || "제목 없음"}
        </p>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
          {item.editor && <UserBadge user={item.editor} size="xs" />}
          <span>
            {formatDistanceToNow(item.deletedAt, {
              addSuffix: true,
              locale: ko,
            })}{" "}
            삭제
          </span>
          {item.descendantCount > 0 && (
            <span>· 하위 {item.descendantCount}개 포함</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={restore}
          disabled={pending}
        >
          <RotateCcw className="size-4" /> 복원
        </Button>
      </div>
    </li>
  );
}
