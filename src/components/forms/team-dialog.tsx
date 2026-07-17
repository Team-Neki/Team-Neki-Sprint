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
import { createTeam, updateTeam } from "@/server/actions/teams";

type Existing = {
  id: string;
  key: string;
  name: string;
  color: string | null;
};

// 팀 색상 팔레트(in-product 태그 색 예외). 새 채도 액센트 도입 대신 소수의 미리 정한 값.
const COLORS = [
  "#8b5cf6",
  "#0070f3",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#ef4444",
  "#64748b",
];

export function TeamDialog({
  team,
  trigger,
}: {
  team?: Existing;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        {/*
          폼 필드 state 는 이 자식(TeamForm)에 둔다. Base UI 는 닫히면 popup 하위를
          언마운트하므로(keepMounted=false), 매 열림마다 새로 마운트되어 폼이 항상
          초기값으로 리셋된다(만들기=빈 폼, 수정=원본 값).
        */}
        <TeamForm team={team} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function TeamForm({
  team,
  onClose,
}: {
  team?: Existing;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const isEdit = !!team;
  const [key, setKey] = useState(team?.key ?? "");
  const [name, setName] = useState(team?.name ?? "");
  const [color, setColor] = useState<string | null>(team?.color ?? COLORS[0]);

  function submit() {
    if (!isEdit && !key.trim()) {
      toast.error("key를 입력하세요");
      return;
    }
    if (!name.trim()) {
      toast.error("이름을 입력하세요");
      return;
    }
    const payload = { key: key.toUpperCase(), name, color };
    start(async () => {
      try {
        if (team) await updateTeam(team.id, payload);
        else await createTeam(payload);
        toast.success(team ? "수정했습니다" : "팀을 만들었습니다");
        onClose();
        router.refresh();
      } catch {
        toast.error(
          team ? "저장에 실패했습니다" : "저장 실패 (key 중복 여부 확인)",
        );
      }
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{team ? "팀 수정" : "새 팀"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label>key (이슈 접두어)</Label>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="예: DESIGN"
            disabled={isEdit}
            autoFocus={!isEdit}
          />
          {isEdit && (
            <p className="text-muted-foreground text-xs">
              key는 이슈 표시에 쓰여 생성 후 변경할 수 없습니다.
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <Label>이름</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 디자인"
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
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </Button>
      </DialogFooter>
    </>
  );
}
