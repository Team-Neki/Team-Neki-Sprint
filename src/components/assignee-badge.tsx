import { UserBadge, type MiniUser } from "@/components/user-badge";
import type { TeamOption } from "@/components/selects/option-select";
import { cn } from "@/lib/utils";

/**
 * 태스크 담당자 표시 배지(B4). 담당자는 유저 또는 팀 중 하나(상호배타)라,
 * 유저면 기존 `UserBadge`(아바타), 팀이면 컴팩트한 색 도트 + mono key 칩(팀명 툴팁)을
 * 보여준다. 둘 다 없으면 `UserBadge`(null) 가 "미지정" 을 렌더한다.
 */
export function AssigneeBadge({
  user,
  team,
  hideName,
  size = "sm",
  className,
}: {
  user: MiniUser | null | undefined;
  team: TeamOption | null | undefined;
  hideName?: boolean;
  size?: "xs" | "sm";
  className?: string;
}) {
  if (user) {
    return (
      <UserBadge user={user} hideName={hideName} size={size} className={className} />
    );
  }
  if (team) {
    return (
      <span
        className={cn("inline-flex items-center gap-1", className)}
        title={team.name}
      >
        <span
          className="size-2 shrink-0 rounded-full"
          style={team.color ? { backgroundColor: team.color } : undefined}
        />
        <span className="font-mono text-xs">{team.key}</span>
      </span>
    );
  }
  return <UserBadge user={null} />;
}
