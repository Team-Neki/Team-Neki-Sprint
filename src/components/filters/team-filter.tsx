"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  OptionSelect,
  renderTeamKey,
  renderTeamOption,
} from "@/components/selects/option-select";
import type { TeamOption } from "@/components/selects/option-select";

// TeamOption 은 selects/option-select 로 단일화됐다. 기존 import 경로 호환을 위해 re-export.
export type { TeamOption };

const ALL = "__all__";

/**
 * 팀(유저 그룹) 단위 URL 필터. owner-filter.tsx 와 같은 searchParams 패턴을 재사용해
 * 에픽/태스크 목록에서 owner·assignee 필터와 나란히 얹는다(서로의 파라미터를 안 건드림).
 */
export function TeamFilter({
  teams,
  paramKey = "team",
}: {
  teams: TeamOption[];
  paramKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === ALL) next.delete(paramKey);
    else next.set(paramKey, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const active = params.get(paramKey);

  return (
    <>
      <OptionSelect<TeamOption>
        value={active ?? ALL}
        onValueChange={(v) => setParam(v)}
        options={teams}
        getValue={(t) => t.id}
        renderOption={(t) => renderTeamOption(t)}
        renderTriggerOption={renderTeamKey}
        triggerClassName="w-40"
        leadingOption={{ value: ALL, label: "모든 팀", triggerLabel: "팀" }}
      />

      {active && (
        <Button variant="ghost" size="sm" onClick={() => setParam(null)}>
          <X className="size-4" /> 초기화
        </Button>
      )}
    </>
  );
}
