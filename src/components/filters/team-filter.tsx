"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckboxFilter } from "@/components/filters/checkbox-filter";
import { renderTeamOption } from "@/components/selects/option-select";
import type { TeamOption } from "@/components/selects/option-select";

// TeamOption 은 selects/option-select 로 단일화됐다. 기존 import 경로 호환을 위해 re-export.
export type { TeamOption };

/**
 * 팀(유저 그룹) 단위 URL 필터. owner-filter.tsx 와 같은 searchParams 패턴을 재사용해
 * 에픽/태스크 목록에서 owner·assignee 필터와 나란히 얹는다(서로의 파라미터를 안 건드림).
 * F6 이후 다중선택 체크박스(콤마구분 값)로 동작한다.
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

  const selected = (params.get(paramKey) ?? "").split(",").filter(Boolean);

  function clear() {
    const next = new URLSearchParams(params.toString());
    next.delete(paramKey);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const options = teams.map((t) => ({
    value: t.id,
    label: renderTeamOption(t),
    keywords: `${t.key} ${t.name}`,
  }));

  return (
    <>
      <CheckboxFilter paramKey={paramKey} label="팀" options={options} />

      {selected.length > 0 && (
        <Button variant="ghost" size="sm" onClick={clear}>
          <X className="size-4" /> 초기화
        </Button>
      )}
    </>
  );
}
