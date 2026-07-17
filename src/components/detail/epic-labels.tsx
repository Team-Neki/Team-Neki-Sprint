"use client";

import { EntityLabels, type LabelItem } from "@/components/detail/entity-labels";
import { addLabelToEpic, removeLabelFromEpic } from "@/server/actions/labels";

/** 에픽 라벨 편집. 공용 EntityLabels 에 에픽 부여/해제 액션을 주입한다. */
export function EpicLabels({
  epicId,
  labels,
  allLabels,
  align,
}: {
  epicId: string;
  labels: LabelItem[];
  allLabels: LabelItem[];
  /** 표 셀에선 "start"(헤더와 좌측 정렬), 상세 시트 메타행은 기본 "end". */
  align?: "start" | "end";
}) {
  return (
    <EntityLabels
      labels={labels}
      allLabels={allLabels}
      attach={(labelId) => addLabelToEpic(epicId, labelId)}
      detach={(labelId) => removeLabelFromEpic(epicId, labelId)}
      align={align}
    />
  );
}
