"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OptionSelect, renderTeamOption } from "@/components/selects/option-select";
import { setUserTeam } from "@/server/actions/teams";
import type { TeamOption } from "@/components/selects/option-select";

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
    <OptionSelect<TeamOption>
      value={teamId ?? NONE}
      onValueChange={onChange}
      disabled={pending}
      options={teams}
      getValue={(t) => t.id}
      renderOption={(t) => renderTeamOption(t)}
      triggerClassName="w-44"
      leadingOption={{ value: NONE, label: "무소속" }}
    />
  );
}
