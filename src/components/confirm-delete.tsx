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
  undo,
  trigger,
  title = "삭제하시겠어요?",
  description = "이 작업은 되돌릴 수 없습니다.",
  redirectTo,
  open: openProp,
  onOpenChange,
}: {
  onConfirm: () => Promise<void>;
  /** 제공되면 삭제 성공 토스트에 '실행취소' 버튼을 붙인다(soft-delete 등 복원 가능한 경우만). */
  undo?: () => Promise<void>;
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

  // 실행취소: 복원 액션 호출 후 새로고침. 토스트 액션은 sonner 가 클릭 시 자동 닫는다.
  function runUndo() {
    if (!undo) return;
    void (async () => {
      try {
        await undo();
        router.refresh();
        toast.success("복원했습니다");
      } catch {
        toast.error("복원에 실패했습니다");
      }
    })();
  }

  function confirm() {
    start(async () => {
      try {
        await onConfirm();
        setOpen(false);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
        if (undo) {
          toast.success("삭제했습니다", {
            action: { label: "실행취소", onClick: runUndo },
          });
        } else {
          toast.success("삭제했습니다");
        }
      } catch {
        toast.error("삭제에 실패했습니다");
      }
    });
  }

  // Enter 로 삭제 확정: 포커스가 취소 버튼에 있어도 항상 삭제가 눌리도록, 팝업
  // 컨테이너에서 Enter 를 잡아 기본 동작(포커스된 버튼의 활성화)을 막고 confirm().
  // IME 조합 중이거나 이미 처리 중이면 무시.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || pending) return;
    e.preventDefault();
    confirm();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-sm" onKeyDown={onKeyDown}>
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
