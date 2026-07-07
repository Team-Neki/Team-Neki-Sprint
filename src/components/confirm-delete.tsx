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
  open: openProp,
  onOpenChange,
}: {
  onConfirm: () => Promise<void>;
  /** 없으면 controlled 모드(open/onOpenChange 로 외부 제어). 예: 컨텍스트 메뉴에서 열기. */
  trigger?: React.ReactElement;
  title?: string;
  description?: string;
  redirectTo?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (v: boolean) => (onOpenChange ?? setInternalOpen)(v);
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
      {trigger && <DialogTrigger render={trigger} />}
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
