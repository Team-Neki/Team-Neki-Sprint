// 스프린트 쓰기 코어(actor 주입). 다이얼로그 저장과 인라인 편집 서버 액션이 공유한다.
// use server 지시어가 없어 서버 액션으로 노출되지 않는다 — 클라이언트가 actor 를 위조해 호출할 수 없다.
// ponytail: import 가드는 prisma 가 클라이언트 번들 빌드를 깨는 것으로 대신한다. 명시적 가드가 필요하면 server-only 를 설치해 import.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sprintSchema } from "@/lib/validators";
import { logActivity, diffFields } from "@/server/activity";
import { notifyNewMentions } from "@/server/notify";
import type { Actor } from "@/lib/authz";
import { parsePatch } from "@/server/services/patch";

// 스프린트 인라인 편집(diff 대상). 제목이 title 이 아니라 name, 기한이 dueDate 가
// 아니라 endDate 인 점만 다른 엔티티와 다르다(모델 차이).
const SPRINT_EDITABLE = {
  name: true,
  description: true,
  status: true,
  startDate: true,
  endDate: true,
} as const;

/** updateSprintFields·updateSprint 의 actor 주입 코어. */
export async function updateSprintFieldsCore(
  actor: Actor,
  id: string,
  input: unknown,
) {
  const patch = parsePatch(sprintSchema, input);

  const current = await prisma.sprint.findUnique({
    where: { id },
    select: SPRINT_EDITABLE,
  });
  if (!current) throw new Error("스프린트를 찾을 수 없습니다");

  const { changes, data } = diffFields(current, patch);
  if (changes.length === 0) return { id };

  const sprint = await prisma.sprint.update({ where: { id }, data });

  await Promise.all(
    changes.map((c) =>
      logActivity({
        userId: actor.id,
        entityType: "sprint",
        entityId: id,
        action: "field_changed",
        meta: { field: c.field, from: c.from, to: c.to },
      }),
    ),
  );

  if (changes.some((c) => c.field === "description")) {
    await notifyNewMentions({
      actorId: actor.id,
      entityType: "sprint",
      entityId: id,
      context: sprint.name,
      before: current.description,
      after: sprint.description,
    });
  }

  revalidatePath("/sprints");
  revalidatePath(`/sprints/${id}`);
  // 스프린트 이름·상태는 프로젝트 목록에도 표시된다.
  revalidatePath("/projects");
  return { id };
}
