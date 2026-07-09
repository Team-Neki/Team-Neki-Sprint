"use client";

import { EntityLabels, type LabelItem } from "@/components/detail/entity-labels";
import { addLabelToEpic, removeLabelFromEpic } from "@/server/actions/labels";

/** 에픽 라벨 편집. 공용 EntityLabels 에 에픽 부여/해제 액션을 주입한다. */
export function EpicLabels({
  epicId,
  labels,
  allLabels,
}: {
  epicId: string;
  labels: LabelItem[];
  allLabels: LabelItem[];
}) {
  return (
    <EntityLabels
      labels={labels}
      allLabels={allLabels}
      attach={(labelId) => addLabelToEpic(epicId, labelId)}
      detach={(labelId) => removeLabelFromEpic(epicId, labelId)}
    />
  );
}
