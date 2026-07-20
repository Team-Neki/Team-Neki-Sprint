"use client";

import { EntityLabels, type LabelItem } from "@/components/detail/entity-labels";
import {
  addLabelToProject,
  removeLabelFromProject,
} from "@/server/actions/labels";

/** 프로젝트 라벨 편집. 공용 EntityLabels 에 프로젝트 부여/해제 액션을 주입한다. */
export function ProjectLabels({
  projectId,
  labels,
  allLabels,
  align,
  layout,
}: {
  projectId: string;
  labels: LabelItem[];
  allLabels: LabelItem[];
  /** 표 셀에선 "start"(헤더와 좌측 정렬), 상세 시트 메타행은 기본 "end". */
  align?: "start" | "end";
  layout?: "wrap" | "row";
}) {
  return (
    <EntityLabels
      labels={labels}
      allLabels={allLabels}
      attach={(labelId) => addLabelToProject(projectId, labelId)}
      detach={(labelId) => removeLabelFromProject(projectId, labelId)}
      align={align}
      layout={layout}
    />
  );
}
