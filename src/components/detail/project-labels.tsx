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
}: {
  projectId: string;
  labels: LabelItem[];
  allLabels: LabelItem[];
}) {
  return (
    <EntityLabels
      labels={labels}
      allLabels={allLabels}
      attach={(labelId) => addLabelToProject(projectId, labelId)}
      detach={(labelId) => removeLabelFromProject(projectId, labelId)}
    />
  );
}
