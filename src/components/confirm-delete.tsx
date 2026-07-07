"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ConfirmDelete({
  onConfirm,
  trigger,
  title = "삭제하시겠어요?",
  description = "이 작업은 되돌릴 수 없습니다.",
  redirectTo,
}: {
  onConfirm: () => Promise<void>;
  trigger: React.ReactElement;
  title?: string;
  description?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      try {
        await onConfirm();
        toast.success("삭제했습니다");
        setOpen(false);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } catch {
        toast.error("삭제에 실패했습니다");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "삭제 중…" : "삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
