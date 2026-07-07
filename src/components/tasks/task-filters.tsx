"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Status } from "@prisma/client";
import { STATUS_ORDER, STATUS_META } from "@/lib/constants";
import type { MiniUser } from "@/components/user-badge";
import type { TeamOption } from "@/components/filters/team-filter";

const ALL = "__all__";

export function TaskFilters({
  members,
  teams,
}: {
  members: MiniUser[];
  teams: TeamOption[];
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

  const hasFilters = ["status", "assignee", "team", "q"].some((k) =>
    params.get(k),
  );

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => setParam("q", e.target.value)}
          placeholder="제목 검색"
          className="w-52 pl-8"
        />
      </div>

      <Select
        value={params.get("status") ?? ALL}
        onValueChange={(v) => setParam("status", v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="상태">
            {(v: string) =>
              v && v !== ALL ? STATUS_META[v as Status].label : "상태"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>모든 상태</SelectItem>
          {STATUS_ORDER.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_META[s].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get("assignee") ?? ALL}
        onValueChange={(v) => setParam("assignee", v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="담당자">
            {(v: string) => {
              if (!v || v === ALL) return "담당자";
              const m = members.find((x) => x.id === v);
              return m ? (m.name ?? m.email) : "담당자";
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>모든 담당자</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name ?? m.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get("team") ?? ALL}
        onValueChange={(v) => setParam("team", v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="팀">
            {(v: string) => {
              const t = teams.find((x) => x.id === v);
              if (!t) return "팀";
              return (
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={t.color ? { backgroundColor: t.color } : undefined}
                  />
                  <span className="font-mono text-xs">{t.key}</span>
                </span>
              );
            }}
          </SelectValue>
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
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
