"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setUserTeam } from "@/server/actions/teams";
import type { TeamOption } from "@/components/filters/team-filter";

const NONE = "__none__";

/** 유저 한 명의 팀 배정 인라인 select. 변경 즉시 서버 확정 후 새로고침. */
export function MemberTeamSelect({
  userId,
  teamId,
  teams,
}: {
  userId: string;
  teamId: string | null;
  teams: TeamOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onChange(value: string | null) {
    const next = !value || value === NONE ? null : value;
    start(async () => {
      try {
        await setUserTeam(userId, next);
        router.refresh();
      } catch {
        toast.error("팀 배정에 실패했습니다");
      }
    });
  }

  return (
    <Select value={teamId ?? NONE} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-44">
        <SelectValue placeholder="팀 선택">
          {(v: string) => {
            if (!v || v === NONE) return "무소속";
            const t = teams.find((x) => x.id === v);
            if (!t) return "무소속";
            return (
              <span className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={t.color ? { backgroundColor: t.color } : undefined}
                />
                <span className="font-mono text-xs">{t.key}</span>
                <span className="text-muted-foreground">{t.name}</span>
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>무소속</SelectItem>
        {teams.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <span className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={t.color ? { backgroundColor: t.color } : undefined}
              />
              <span className="font-mono text-xs">{t.key}</span>
              <span className="text-muted-foreground">{t.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
