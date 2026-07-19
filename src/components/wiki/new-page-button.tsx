"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createWikiPage } from "@/server/actions/wiki";

export function NewPageButton({
  parentId,
  folderId,
  variant = "full",
  title = "하위 페이지 추가",
}: {
  parentId?: string;
  folderId?: string;
  variant?: "full" | "icon";
  title?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function create() {
    start(async () => {
      try {
        const { id } = await createWikiPage({
          title: "제목 없음",
          parentId: parentId ?? null,
          folderId: folderId ?? null,
        });
        // 편집 모드 + 제목 포커스로 바로 진입(저장 전까지 초안).
        router.push(`/wiki/${id}?edit=1`);
        router.refresh();
      } catch {
        toast.error("페이지 생성에 실패했습니다");
      }
    });
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          create();
        }}
        disabled={pending}
        className={cn(
          "hover:bg-accent text-muted-foreground hover:text-foreground rounded p-0.5",
        )}
        title={title}
      >
        <Plus className="size-3.5" />
      </button>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={create} disabled={pending}>
      <Plus className="size-4" /> 새 페이지
    </Button>
  );
}
