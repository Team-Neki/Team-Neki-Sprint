"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

export type TeamOption = {
  id: string;
  key: string;
  name: string;
  color?: string | null;
};

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
      <Select value={active ?? ALL} onValueChange={(v) => setParam(v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="팀" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>모든 팀</SelectItem>
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

      {active && (
        <Button variant="ghost" size="sm" onClick={() => setParam(null)}>
          <X className="size-4" /> 초기화
        </Button>
      )}
    </>
  );
}
