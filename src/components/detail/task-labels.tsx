"use client";

import { EntityLabels, type LabelItem } from "@/components/detail/entity-labels";
import { addLabelToTask, removeLabelFromTask } from "@/server/actions/labels";

export type { LabelItem };

/** 태스크 라벨 편집(C8). 공용 EntityLabels 에 태스크 부여/해제 액션을 주입한다. */
export function TaskLabels({
  taskId,
  labels,
  allLabels,
  align,
}: {
  taskId: string;
  labels: LabelItem[];
  allLabels: LabelItem[];
  /** 표 셀에선 "start"(헤더와 좌측 정렬), 상세 시트 메타행은 기본 "end". */
  align?: "start" | "end";
}) {
  return (
    <EntityLabels
      labels={labels}
      allLabels={allLabels}
      attach={(labelId) => addLabelToTask(taskId, labelId)}
      detach={(labelId) => removeLabelFromTask(taskId, labelId)}
      align={align}
    />
  );
}
