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
import type { MiniUser } from "@/components/user-badge";

const ALL = "__all__";

/**
 * 사용자(오너/담당자) 단위 URL 필터. 태스크 필터(task-filters.tsx)와 같은
 * searchParams 방식을 재사용해 이니셔티브/에픽(오너)·보드(담당자)에서 공통으로 쓴다.
 *
 * paramKey 로 URL 파라미터 키를 바꿔 오너(`owner`)/담당자(`assignee`) 양쪽에 대응한다.
 * 초기화는 자기 파라미터만 지우므로, 4번(유저 그룹) 필터를 같은 바에 얹어도
 * 서로의 값을 건드리지 않는다.
 */
export function OwnerFilter({
  members,
  paramKey = "owner",
  placeholder = "오너",
  allLabel = "모든 오너",
}: {
  members: MiniUser[];
  paramKey?: string;
  placeholder?: string;
  allLabel?: string;
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
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Select value={active ?? ALL} onValueChange={(v) => setParam(v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name ?? m.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {active && (
        <Button variant="ghost" size="sm" onClick={() => setParam(null)}>
          <X className="size-4" /> 초기화
        </Button>
      )}
    </div>
  );
}
