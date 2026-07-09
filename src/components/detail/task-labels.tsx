"use client";

import { EntityLabels, type LabelItem } from "@/components/detail/entity-labels";
import { addLabelToTask, removeLabelFromTask } from "@/server/actions/labels";

export type { LabelItem };

/** 태스크 라벨 편집(C8). 공용 EntityLabels 에 태스크 부여/해제 액션을 주입한다. */
export function TaskLabels({
  taskId,
  labels,
  allLabels,
}: {
  taskId: string;
  labels: LabelItem[];
  allLabels: LabelItem[];
}) {
  return (
    <EntityLabels
      labels={labels}
      allLabels={allLabels}
      attach={(labelId) => addLabelToTask(taskId, labelId)}
      detach={(labelId) => removeLabelFromTask(taskId, labelId)}
    />
  );
}
