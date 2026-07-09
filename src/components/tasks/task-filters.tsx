"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  OptionSelect,
  memberLabel,
  renderTeamKey,
} from "@/components/selects/option-select";
import type { Status } from "@prisma/client";
import { STATUS_ORDER, STATUS_META } from "@/lib/constants";
import type { MiniUser } from "@/components/user-badge";
import type { TeamOption } from "@/components/selects/option-select";

const ALL = "__all__";

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

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === ALL) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  const hasFilters = ["status", "assignee", "team", "label", "q"].some((k) =>
    params.get(k),
  );

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-52">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => setParam("q", e.target.value)}
          placeholder="제목 검색"
          className="w-full pl-8"
        />
      </div>

      <OptionSelect<Status>
        value={params.get("status") ?? ALL}
        onValueChange={(v) => setParam("status", v)}
        options={STATUS_ORDER}
        getValue={(s) => s}
        renderOption={(s) => STATUS_META[s].label}
        triggerClassName="w-36"
        leadingOption={{ value: ALL, label: "모든 상태", triggerLabel: "상태" }}
      />

      <OptionSelect<MiniUser>
        value={params.get("assignee") ?? ALL}
        onValueChange={(v) => setParam("assignee", v)}
        options={members}
        getValue={(m) => m.id}
        renderOption={memberLabel}
        triggerClassName="w-40"
        leadingOption={{ value: ALL, label: "모든 담당자", triggerLabel: "담당자" }}
      />

      <OptionSelect<TeamOption>
        value={params.get("team") ?? ALL}
        onValueChange={(v) => setParam("team", v)}
        options={teams}
        getValue={(t) => t.id}
        renderOption={renderTeamKey}
        triggerClassName="w-40"
        leadingOption={{ value: ALL, label: "모든 팀", triggerLabel: "팀" }}
      />

      <OptionSelect<LabelFilterOption>
        value={params.get("label") ?? ALL}
        onValueChange={(v) => setParam("label", v)}
        options={labels}
        getValue={(l) => l.id}
        renderOption={(l) => (
          <span className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: l.color }}
            />
            {l.name}
          </span>
        )}
        triggerClassName="w-40"
        leadingOption={{ value: ALL, label: "모든 라벨", triggerLabel: "라벨" }}
      />

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
