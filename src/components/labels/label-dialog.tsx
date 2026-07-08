"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLabel, updateLabel } from "@/server/actions/labels";

type Existing = { id: string; name: string; color: string };

// 라벨 색 팔레트(in-product 태그 예외). team-dialog 와 동일 계열로 통일.
const COLORS = [
  "#8b5cf6",
  "#0070f3",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#ef4444",
  "#64748b",
];

/** 라벨 생성/수정 다이얼로그(C8 관리 화면). team-dialog 패턴을 따른다. */
export function LabelDialog({
  label,
  trigger,
}: {
  label?: Existing;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const [name, setName] = useState(label?.name ?? "");
  const [color, setColor] = useState(label?.color ?? COLORS[0]);

  function submit() {
    if (!name.trim()) {
      toast.error("이름을 입력하세요");
      return;
    }
    const payload = { name, color };
    start(async () => {
      try {
        if (label) await updateLabel(label.id, payload);
        else await createLabel(payload);
        toast.success(label ? "수정했습니다" : "라벨을 만들었습니다");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "저장에 실패했습니다");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label ? "라벨 수정" : "새 라벨"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>이름</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 버그"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>색상</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`색상 ${c}`}
                  className={
                    "size-7 rounded-full ring-offset-2 transition-shadow" +
                    (color === c ? " ring-primary ring-2" : "")
                  }
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
