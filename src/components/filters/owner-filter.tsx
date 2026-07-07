"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptionSelect, memberLabel } from "@/components/selects/option-select";
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
  children,
}: {
  members: MiniUser[];
  paramKey?: string;
  placeholder?: string;
  allLabel?: string;
  children?: React.ReactNode;
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
      <OptionSelect<MiniUser>
        value={active ?? ALL}
        onValueChange={(v) => setParam(v)}
        options={members}
        getValue={(m) => m.id}
        renderOption={memberLabel}
        placeholder={placeholder}
        triggerClassName="w-40"
        leadingOption={{ value: ALL, label: allLabel, triggerLabel: placeholder }}
      />

      {active && (
        <Button variant="ghost" size="sm" onClick={() => setParam(null)}>
          <X className="size-4" /> 초기화
        </Button>
      )}

      {children}
    </div>
  );
}
