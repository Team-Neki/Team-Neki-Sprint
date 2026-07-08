"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { RotateCcw, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { ConfirmDelete } from "@/components/confirm-delete";
import { restoreWikiPage, purgeWikiPage } from "@/server/actions/wiki";

export type TrashItem = {
  id: string;
  title: string;
  deletedAt: Date;
  editor: MiniUser | null;
  descendantCount: number;
};

export function TrashList({ items }: { items: TrashItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <Trash2 className="size-8 opacity-40" />
        <p className="text-sm">휴지통이 비어 있습니다.</p>
      </div>
    );
  }

  return (
    <ul className="divide-border divide-y rounded-lg border">
      {items.map((item) => (
        <TrashRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function TrashRow({ item }: { item: TrashItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmPurge, setConfirmPurge] = useState(false);

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
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmPurge(true)}
          disabled={pending}
          aria-label="영구 삭제"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <ConfirmDelete
        open={confirmPurge}
        onOpenChange={setConfirmPurge}
        onConfirm={() => purgeWikiPage(item.id)}
        title="영구 삭제할까요?"
        description={
          item.descendantCount > 0
            ? `하위 ${item.descendantCount}개 페이지와 모든 버전·댓글이 영구 삭제됩니다. 되돌릴 수 없습니다.`
            : "이 페이지와 모든 버전·댓글이 영구 삭제됩니다. 되돌릴 수 없습니다."
        }
      />
    </li>
  );
}
