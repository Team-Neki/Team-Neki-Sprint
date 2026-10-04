"use client";

import { CheckboxFilter } from "@/components/filters/checkbox-filter";
import { memberLabel } from "@/components/selects/option-select";
import type { MiniUser } from "@/components/user-badge";

/**
 * 사용자(오너/담당자) 단위 URL 필터. 태스크 필터(task-filters.tsx)와 같은
 * searchParams 방식을 재사용해 이니셔티브/에픽(오너)·보드(담당자)에서 공통으로 쓴다.
 *
 * paramKey 로 URL 파라미터 키를 바꿔 오너(`owner`)/담당자(`assignee`) 양쪽에 대응한다.
 * F6 이후 다중선택 체크박스(콤마구분 값)로 동작하며, 초기화는 자기 파라미터만 지우므로
 * 4번(유저 그룹) 필터를 같은 바에 얹어도 서로의 값을 건드리지 않는다.
 *
 * 자기 칩(+초기화)만 렌더한다 — 줄 배치는 `FilterBar` 가 소유한다.
 */
export function OwnerFilter({
  members,
  paramKey = "owner",
  placeholder = "오너",
}: {
  members: MiniUser[];
  paramKey?: string;
  placeholder?: string;
  /** 하위호환용 prop(다중선택 전환 후 트리거에는 미사용). */
  allLabel?: string;
}) {
  const options = members.map((m) => ({
    value: m.id,
    label: memberLabel(m),
    keywords: `${m.name ?? ""} ${m.email}`.trim(),
  }));

  return (
    <CheckboxFilter
      paramKey={paramKey}
      label={placeholder}
      options={options}
      clearable
    />
  );
}
