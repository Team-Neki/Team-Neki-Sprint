"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckboxFilter } from "@/components/filters/checkbox-filter";
import {
  STATUS_ORDER,
  STATUS_META,
  SPRINT_STATUS_ORDER,
  SPRINT_STATUS_META,
} from "@/lib/constants";

/**
 * 상태 URL 필터(다중선택, F6 규약의 콤마구분 값). 목록에서 완료 항목 등을 걸러
 * 불필요한 노출을 줄이는 용도 — 태스크/에픽/프로젝트는 `Status`,
 * 스프린트는 값 집합이 다른 `SprintStatus` 를 쓴다(`kind` 로 구분).
 *
 * 자기 칩(+초기화)만 렌더한다 — 줄 배치는 `FilterBar` 가 소유하고, 다른 필터는 같은
 * 바 안에 형제로 나란히 둔다. 초기화 버튼은 자기 파라미터만 지우므로 다른 필터 값을
 * 건드리지 않는다.
 */
export function StatusFilter({
  kind = "entity",
  paramKey = "status",
}: {
  kind?: "entity" | "sprint";
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

  const options =
    kind === "sprint"
      ? SPRINT_STATUS_ORDER.map((s) => ({
          value: s,
          label: SPRINT_STATUS_META[s].label,
        }))
      : STATUS_ORDER.map((s) => ({
          value: s,
          label: STATUS_META[s].label,
        }));

  return (
    <>
      <CheckboxFilter paramKey={paramKey} label="상태" options={options} />

      {selected.length > 0 && (
        <Button variant="ghost" size="sm" onClick={clear}>
          <X className="size-4" /> 초기화
        </Button>
      )}
    </>
  );
}
