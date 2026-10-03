// 에픽 쓰기 코어(actor 주입). 서버 액션과 MCP API 라우트가 공유한다.
// use server 지시어가 없어 서버 액션으로 노출되지 않는다 — 클라이언트가 actor 를 위조해 호출할 수 없다.
// ponytail: import 가드는 prisma 가 클라이언트 번들 빌드를 깨는 것으로 대신한다. 명시적 가드가 필요하면 server-only 를 설치해 import.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { epicSchema } from "@/lib/validators";
import { logActivity, diffFields } from "@/server/activity";
import { notifyNewMentions } from "@/server/notify";
import { nextTeamNumber } from "@/server/keys";
import { assertCanManage, type Actor } from "@/lib/authz";

/** createEpic의 actor 주입 코어. 서버 액션과 MCP API 라우트가 공유한다. */
export async function createEpicCore(actor: Actor, input: unknown) {
  const data = epicSchema.parse(input);

  // 팀 시퀀스를 원자적으로 증가시켜 number를 부여한다(epic·task 공유).
  const epic = await prisma.$transaction(async (tx) => {
    const number = await nextTeamNumber(tx, data.teamId);
    // 담당자(ownerId)는 미지정 시 null 로 둔다 — 만든 사람으로 자동 지정하지 않는다.
    return tx.epic.create({
      data: { ...data, number },
    });
  });

  await logActivity({
    userId: actor.id,
    entityType: "epic",
    entityId: epic.id,
    action: "created",
    meta: { title: epic.title },
  });

  revalidatePath("/epics");
  if (epic.projectId) revalidatePath(`/projects/${epic.projectId}`);
  // 에픽 캐시 + 프로젝트 캐시(하위 에픽 수 표시). 태스크는 새 에픽엔 아직 없음.
  return { id: epic.id };
}

function revalidateEpicPaths(id: string, projectId: string | null) {
  revalidatePath("/epics");
  revalidatePath(`/epics/${id}`);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

// 에픽 인라인 편집(diff 대상). 팀/번호는 불변이라 제외.
const EPIC_EDITABLE = {
  title: true,
  description: true,
  status: true,
  priority: true,
  ownerId: true,
  projectId: true,
  startDate: true,
  dueDate: true,
} as const;

/** updateEpicFields의 actor 주입 코어. 서버 액션과 MCP API 라우트가 공유한다. */
export async function updateEpicFieldsCore(
  actor: Actor,
  id: string,
  input: unknown,
) {
  const patch = epicSchema.partial().parse(input) as Record<string, unknown>;
  // 팀(teamId)은 생성 후 불변 — 표시 key 안정성 위해 patch 에서 제외.
  delete patch.teamId;

  const current = await prisma.epic.findUnique({
    where: { id },
    select: EPIC_EDITABLE,
  });
  if (!current) throw new Error("에픽을 찾을 수 없습니다");

  const { changes, data } = diffFields(current, patch);
  if (changes.length === 0) return { id };

  const epic = await prisma.epic.update({ where: { id }, data });

  await Promise.all(
    changes.map((c) =>
      logActivity({
        userId: actor.id,
        entityType: "epic",
        entityId: id,
        action: "field_changed",
        meta: { field: c.field, from: c.from, to: c.to },
      }),
    ),
  );

  if (changes.some((c) => c.field === "description")) {
    await notifyNewMentions({
      actorId: actor.id,
      entityType: "epic",
      entityId: id,
      context: epic.title,
      before: current.description,
      after: epic.description,
    });
  }

  revalidateEpicPaths(id, epic.projectId);
  // 프로젝트 이동 시 이전 프로젝트 상세도 무효화.
  if (current.projectId && current.projectId !== epic.projectId) {
    revalidatePath(`/projects/${current.projectId}`);
  }
  return { id };
}

/** deleteEpic의 actor 주입 코어. 서버 액션과 MCP API 라우트가 공유한다. */
export async function deleteEpicCore(actor: Actor, id: string) {
  const epic = await prisma.epic.findUnique({
    where: { id },
    select: { ownerId: true },
  });
  if (!epic) throw new Error("에픽을 찾을 수 없습니다");
  // 삭제는 소유자(owner) 또는 ADMIN 만.
  assertCanManage(actor, "에픽", epic.ownerId);
  await prisma.epic.delete({ where: { id } });
  await logActivity({
    userId: actor.id,
    entityType: "epic",
    entityId: id,
    action: "deleted",
  });
  revalidatePath("/epics");
}
