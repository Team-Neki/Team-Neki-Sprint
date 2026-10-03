"use client";

import { EntityLabels, type LabelsProps } from "@/components/detail/entity-labels";

/** 프로젝트 라벨 편집. 공용 EntityLabels 에 엔티티 종류만 지정한다. */
export function ProjectLabels({
  projectId,
  ...props
}: LabelsProps & { projectId: string }) {
  return <EntityLabels type="project" id={projectId} {...props} />;
}
