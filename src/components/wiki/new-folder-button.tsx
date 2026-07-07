"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createWikiFolder } from "@/server/actions/wiki";

export function NewFolderButton({
  parentId,
  variant = "full",
  title = "하위 폴더 추가",
}: {
  parentId?: string;
  variant?: "full" | "icon";
  title?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    start(async () => {
      try {
        await createWikiFolder({ name: trimmed, parentId: parentId ?? null });
        setName("");
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("폴더 생성에 실패했습니다");
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          variant === "icon" ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className={cn(
                "hover:bg-accent text-muted-foreground hover:text-foreground rounded p-0.5",
              )}
              title={title}
            >
              <FolderPlus className="size-3.5" />
            </button>
          ) : (
            <Button size="sm" variant="outline" aria-label="새 폴더">
              <FolderPlus className="size-4" /> 폴더
            </Button>
          )
        }
      />
      <PopoverContent align="start" className="w-64">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2"
        >
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="폴더 이름"
            className="h-8"
          />
          <Button type="submit" size="sm" className="h-8 shrink-0" disabled={pending}>
            추가
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
