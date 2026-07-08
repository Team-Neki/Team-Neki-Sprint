"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { labelSchema } from "@/lib/validators";

// schema.prisma 의 Label.color @default 와 일치. color 미지정 create 시 폴백.
const DEFAULT_COLOR = "#94a3b8";

/** plain 라벨 반환 형태(서버 액션 직렬화용, gotchas §7). */
export type LabelResult = { id: string; name: string; color: string };

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

// 라벨은 여러 목록/보드/관리 화면에 배지로 노출되므로 함께 무효화.
// (태스크 상세 /tasks/[id] 등은 force-dynamic 이라 재요청마다 재렌더된다.)
function revalidateLabelSurfaces() {
  revalidatePath("/labels");
  revalidatePath("/tasks");
  revalidatePath("/board");
  revalidatePath("/epics");
  revalidatePath("/projects");
}

export async function createLabel(input: unknown): Promise<LabelResult> {
  await requireUser();
  const data = labelSchema.parse(input);
  try {
    const label = await prisma.label.create({
      data: { name: data.name, color: data.color ?? DEFAULT_COLOR },
    });
    revalidateLabelSurfaces();
    return { id: label.id, name: label.name, color: label.color };
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error(`이미 "${data.name}" 라벨이 있습니다`);
    }
    throw e;
  }
}

/** 이름·색 부분 수정. 이름은 partial 로 받아 넘어온 필드만 갱신한다. */
export async function updateLabel(
  id: string,
  input: unknown,
): Promise<LabelResult> {
  await requireUser();
  const data = labelSchema.partial().parse(input);
  const patch: { name?: string; color?: string } = {};
  if (data.name != null) patch.name = data.name;
  if (data.color != null) patch.color = data.color;

  try {
    const label = await prisma.label.update({ where: { id }, data: patch });
    revalidateLabelSurfaces();
    return { id: label.id, name: label.name, color: label.color };
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error(`이미 "${data.name ?? ""}" 라벨이 있습니다`);
    }
    throw e;
  }
}

export async function deleteLabel(id: string): Promise<void> {
  await requireUser();
  // 조인(LabelsOn*)은 onDelete: Cascade 라 함께 정리된다.
  await prisma.label.delete({ where: { id } });
  revalidateLabelSurfaces();
}

export async function addLabelToTask(taskId: string, labelId: string) {
  await requireUser();
  // 이미 붙어 있어도 idempotent(중복 시 no-op).
  await prisma.labelsOnTasks.upsert({
    where: { taskId_labelId: { taskId, labelId } },
    create: { taskId, labelId },
    update: {},
  });
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/board");
  return { taskId, labelId };
}

export async function removeLabelFromTask(taskId: string, labelId: string) {
  await requireUser();
  // deleteMany 는 대상이 없어도 예외 없이 통과(idempotent).
  await prisma.labelsOnTasks.deleteMany({ where: { taskId, labelId } });
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/board");
  return { taskId, labelId };
}
