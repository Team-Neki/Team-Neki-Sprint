"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckboxFilter } from "@/components/filters/checkbox-filter";
import { useSetSearchParams } from "@/components/filters/use-set-search-params";
import {
  memberLabel,
  renderTeamOption,
} from "@/components/selects/option-select";
import { STATUS_ORDER, STATUS_META } from "@/lib/constants";
import type { MiniUser } from "@/components/user-badge";
import type { TeamOption } from "@/components/selects/option-select";

export type LabelFilterOption = { id: string; name: string; color: string };

// 초기화 대상. sort·dir(표 정렬)은 필터가 아니므로 초기화해도 유지한다.
const FILTER_KEYS = ["status", "assignee", "team", "label", "q"];

export function TaskFilters({
  members,
  teams,
  labels,
}: {
  members: MiniUser[];
  teams: TeamOption[];
  labels: LabelFilterOption[];
}) {
  const params = useSearchParams();
  const setParams = useSetSearchParams();
  const qTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // 언마운트(다른 화면 이동) 후 남은 타이머가 이 목록으로 되돌리지 않게 정리.
  useEffect(() => () => clearTimeout(qTimer.current), []);

  // 제목 검색(q)만 단일값 파라미터로 유지한다. 나머지 필터는 CheckboxFilter 가 직접 URL 을 쓴다.
  // 타이핑마다 페이지를 다시 그리지 않도록 300ms 디바운스.
  function setQ(value: string) {
    clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => setParams({ q: value }), 300);
  }

  function reset() {
    clearTimeout(qTimer.current);
    setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])));
  }

  const hasFilters = FILTER_KEYS.some((k) => params.get(k));

  const statusOptions = STATUS_ORDER.map((s) => ({
    value: s,
    label: STATUS_META[s].label,
  }));

  const memberOptions = members.map((m) => ({
    value: m.id,
    label: memberLabel(m),
    keywords: `${m.name ?? ""} ${m.email}`.trim(),
  }));

  const teamOptions = teams.map((t) => ({
    value: t.id,
    label: renderTeamOption(t),
    keywords: `${t.key} ${t.name}`,
  }));

  const labelOptions = labels.map((l) => ({
    value: l.id,
    label: (
      <span className="flex items-center gap-2">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: l.color }}
        />
        {l.name}
      </span>
    ),
    keywords: l.name,
  }));

  return (
    <>
      <div className="relative w-full sm:w-52">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        {/* 높이는 같은 바의 필터 칩(h-7)과 맞춘다 — 섞이면 items-center 가 칩을 밀어 어긋난다. */}
        <Input
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목 검색"
          className="h-7 w-full pl-8"
        />
      </div>

      <CheckboxFilter paramKey="status" label="상태" options={statusOptions} />
      <CheckboxFilter
        paramKey="assignee"
        label="담당자"
        options={memberOptions}
      />
      <CheckboxFilter paramKey="team" label="팀" options={teamOptions} />
      <CheckboxFilter paramKey="label" label="라벨" options={labelOptions} />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={reset}>
          <X className="size-4" /> 초기화
        </Button>
      )}
    </>
  );
}
