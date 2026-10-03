"use client";

import { EntityLabels, type LabelsProps } from "@/components/detail/entity-labels";

/** 태스크 라벨 편집(C8). 공용 EntityLabels 에 엔티티 종류만 지정한다. */
export function TaskLabels({
  taskId,
  ...props
}: LabelsProps & { taskId: string }) {
  return <EntityLabels type="task" id={taskId} {...props} />;
}
