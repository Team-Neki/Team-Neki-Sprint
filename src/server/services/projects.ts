// 프로젝트 쓰기 코어(actor 주입). 다이얼로그 저장과 인라인 편집 서버 액션이 공유한다.
// use server 지시어가 없어 서버 액션으로 노출되지 않는다 — 클라이언트가 actor 를 위조해 호출할 수 없다.
// ponytail: import 가드는 prisma 가 클라이언트 번들 빌드를 깨는 것으로 대신한다. 명시적 가드가 필요하면 server-only 를 설치해 import.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "@/lib/validators";
import { logActivity, diffFields } from "@/server/activity";
import { notifyNewMentions } from "@/server/notify";
import type { Actor } from "@/lib/authz";
import { parsePatch } from "@/server/services/patch";

function revalidateProjectPaths(id: string, sprintId: string | null) {
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  if (sprintId) revalidatePath(`/sprints/${sprintId}`);
}

// 프로젝트 인라인 편집(diff 대상).
const PROJECT_EDITABLE = {
  title: true,
  description: true,
  status: true,
  priority: true,
  ownerId: true,
  sprintId: true,
  startDate: true,
  dueDate: true,
} as const;

/** updateProjectFields·updateProject 의 actor 주입 코어. */
export async function updateProjectFieldsCore(
  actor: Actor,
  id: string,
  input: unknown,
) {
  const patch = parsePatch(projectSchema, input);

  const current = await prisma.project.findUnique({
    where: { id },
    select: PROJECT_EDITABLE,
  });
  if (!current) throw new Error("프로젝트를 찾을 수 없습니다");

  const { changes, data } = diffFields(current, patch);
  if (changes.length === 0) return { id };

  const project = await prisma.project.update({ where: { id }, data });

  await Promise.all(
    changes.map((c) =>
      logActivity({
        userId: actor.id,
        entityType: "project",
        entityId: id,
        action: "field_changed",
        meta: { field: c.field, from: c.from, to: c.to },
      }),
    ),
  );

  if (changes.some((c) => c.field === "description")) {
    await notifyNewMentions({
      actorId: actor.id,
      entityType: "project",
      entityId: id,
      context: project.title,
      before: current.description,
      after: project.description,
    });
  }

  revalidateProjectPaths(id, project.sprintId);
  // 스프린트 이동 시 이전 스프린트도 무효화.
  if (current.sprintId && current.sprintId !== project.sprintId) {
    revalidatePath(`/sprints/${current.sprintId}`);
  }
  return { id };
}
