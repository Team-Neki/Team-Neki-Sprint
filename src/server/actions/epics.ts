"use server";

import { requireUser } from "@/lib/session";
import {
  createEpicCore,
  updateEpicFieldsCore,
  deleteEpicCore,
} from "@/server/services/epics";

export async function createEpic(input: unknown) {
  const user = await requireUser();
  return createEpicCore(user, input);
}

/** 다이얼로그 저장. 인라인 편집과 같은 코어로 필드별 히스토리·멘션 알림을 적용한다. */
export async function updateEpic(id: string, input: unknown) {
  const user = await requireUser();
  return updateEpicFieldsCore(user, id, input);
}

/**
 * 에픽 상세 인라인 편집(B3) 단일 진입점: patch diff → 바뀐 필드만 update +
 * 필드별 before→after 를 Activity(`field_changed`)로 기록(B8).
 */
export async function updateEpicFields(id: string, input: unknown) {
  const user = await requireUser();
  return updateEpicFieldsCore(user, id, input);
}

export async function deleteEpic(id: string) {
  const user = await requireUser();
  return deleteEpicCore(user, id);
}
