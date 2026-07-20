"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckboxFilter } from "@/components/filters/checkbox-filter";
import {
  memberLabel,
  renderTeamOption,
} from "@/components/selects/option-select";
import { STATUS_ORDER, STATUS_META } from "@/lib/constants";
import type { MiniUser } from "@/components/user-badge";
import type { TeamOption } from "@/components/selects/option-select";

export type LabelFilterOption = { id: string; name: string; color: string };

export function TaskFilters({
  members,
  teams,
  labels,
}: {
  members: MiniUser[];
  teams: TeamOption[];
  labels: LabelFilterOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // 제목 검색(q)만 단일값 파라미터로 유지한다. 나머지 필터는 CheckboxFilter 가 직접 URL 을 쓴다.
  function setQ(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("q", value);
    else next.delete("q");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const hasFilters = ["status", "assignee", "team", "label", "q"].some((k) =>
    params.get(k),
  );

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
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-52">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제목 검색"
          className="w-full pl-8"
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname)}
        >
          <X className="size-4" /> 초기화
        </Button>
      )}
    </div>
  );
}
