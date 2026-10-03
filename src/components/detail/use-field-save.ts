"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateTaskFields } from "@/server/actions/tasks";
import { updateEpicFields } from "@/server/actions/epics";
import { updateProjectFields } from "@/server/actions/projects";
import { updateSprintFields } from "@/server/actions/sprints";

export type DetailEntity = "task" | "epic" | "project" | "sprint";

// 엔티티별 단일 필드 patch 액션(diff 로깅은 서버에서 처리).
const UPDATE: Record<
  DetailEntity,
  (id: string, patch: Record<string, unknown>) => Promise<unknown>
> = {
  task: updateTaskFields,
  epic: updateEpicFields,
  project: updateProjectFields,
  sprint: updateSprintFields,
};

/**
 * 상세 인라인 편집 공용 훅: patch 저장 → 서버 확정 후 router.refresh.
 * `onError` 는 실패 시 호출된다 — 낙관적으로 먼저 보여준 값을 되돌리는 용도.
 */
export function useFieldSave(type: DetailEntity, id: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function save(patch: Record<string, unknown>, onError?: () => void) {
    start(async () => {
      try {
        await UPDATE[type](id, patch);
        router.refresh();
      } catch {
        onError?.();
        toast.error("변경에 실패했습니다");
        router.refresh();
      }
    });
  }
  return { pending, save };
}

/**
 * 방금 고른 값을 서버 확정 전에 먼저 보여준다(낙관적 표시, BACKEND-53).
 *
 * 셀렉트류는 서버가 내려준 값을 그대로 렌더하는데, 저장 후 `router.refresh()` 가
 * route 전체를 다시 가져오기까지 수 초가 걸려 그 동안 트리거가 **옛 값 + 비활성**으로
 * 멈춰 있었다("안 눌렸나?" 하고 다시 눌러 중복 쓰기를 유발).
 *
 * React 19 `useOptimistic` 을 쓰지 않는 이유: 그쪽은 transition 이 끝나는 시점에 값을
 * 되돌리는데, refresh 가 느리면 서버 값이 도착하기 전에 되돌아가 한 번 깜빡인다.
 * 여기서는 **서버 값이 실제로 바뀐 것을 확인한 뒤** override 를 푼다(InlineTitle·
 * InlineDate·InlineNumber 가 이미 쓰던 prop 동기화 패턴을 훅으로 뽑은 것).
 *
 * null 도 유효한 값(미지정 등)이라 로컬 값은 박스에 담아 "override 없음"과 구분한다.
 * 서버 값은 `Object.is` 로 비교하므로 렌더마다 새로 만드는 객체가 아니라 원시값을 넘긴다.
 */
export function useOptimisticValue<T>(serverValue: T) {
  const [local, setLocal] = useState<{ v: T } | null>(null);
  const [prev, setPrev] = useState(serverValue);
  if (!Object.is(serverValue, prev)) {
    setPrev(serverValue);
    setLocal(null);
  }
  const show = (v: T) => setLocal({ v });
  const reset = () => setLocal(null);
  return [local ? local.v : serverValue, show, reset] as const;
}
