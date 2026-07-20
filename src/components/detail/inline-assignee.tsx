"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateTaskFields } from "@/server/actions/tasks";
import {
  AssigneePicker,
  type AssigneeValue,
} from "@/components/selects/assignee-picker";
import type { MiniUser } from "@/components/user-badge";
import type { TeamOption } from "@/components/selects/option-select";

/**
 * 태스크 담당자 인라인 편집(B4·B5). 유저 또는 팀 담당자를 검색 콤보박스로 고르고,
 * 선택에 따라 상대 필드를 null 로 비워 상호배타를 클라이언트에서도 맞춘다(서버도 강제).
 * 상세 메타 카드와 목록 셀(avatarOnly)에서 공유한다.
 */
export function InlineAssignee({
  taskId,
  user,
  team,
  members,
  teams,
  avatarOnly = false,
}: {
  taskId: string;
  user: MiniUser | null;
  team: TeamOption | null;
  members: MiniUser[];
  teams: TeamOption[];
  avatarOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const value: AssigneeValue = user
    ? { kind: "user", id: user.id }
    : team
      ? { kind: "team", id: team.id }
      : null;

  function onChange(next: AssigneeValue) {
    const patch =
      next?.kind === "user"
        ? { assigneeId: next.id, assigneeTeamId: null }
        : next?.kind === "team"
          ? { assigneeTeamId: next.id, assigneeId: null }
          : { assigneeId: null, assigneeTeamId: null };
    start(async () => {
      try {
        await updateTaskFields(taskId, patch);
        router.refresh();
      } catch {
        toast.error("변경에 실패했습니다");
        router.refresh();
      }
    });
  }

  return (
    <AssigneePicker
      value={value}
      members={members}
      teams={teams}
      onChange={onChange}
      disabled={pending}
      avatarOnly={avatarOnly}
    />
  );
}
