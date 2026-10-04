"use client";

import { EntityLabels, type LabelsProps } from "@/components/detail/entity-labels";

/** 에픽 라벨 편집. 공용 EntityLabels 에 엔티티 종류만 지정한다. */
export function EpicLabels({
  epicId,
  ...props
}: LabelsProps & { epicId: string }) {
  return <EntityLabels type="epic" id={epicId} {...props} />;
}
