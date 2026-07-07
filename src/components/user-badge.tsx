import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type MiniUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  // 아바타 hover 툴팁용(조회 시 select 된 경우에만 존재).
  team?: { key: string; name: string } | null;
};

export function initialsOf(user: Pick<MiniUser, "name" | "email">) {
  const base = user.name ?? user.email;
  return (
    base
      .split(/[\s@.]+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function UserBadge({
  user,
  className,
  size = "sm",
  hideName,
}: {
  user: MiniUser | null | undefined;
  className?: string;
  size?: "xs" | "sm";
  hideName?: boolean;
}) {
  if (!user) {
    return <span className="text-muted-foreground text-xs">미지정</span>;
  }
  const avatarSize = size === "xs" ? "size-5" : "size-6";
  const label = user.name ?? user.email;
  // "이름 - 팀명" (팀이 조회된 경우), 아니면 이름만.
  const tip = user.team?.name ? `${label} - ${user.team.name}` : label;

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={cn("inline-flex items-center gap-1.5", className)}
            >
              <Avatar className={avatarSize}>
                {user.image && (
                  <AvatarImage src={user.image} alt={user.name ?? ""} />
                )}
                <AvatarFallback className="text-[10px]">
                  {initialsOf(user)}
                </AvatarFallback>
              </Avatar>
              {!hideName && (
                <span className="truncate text-xs">{label}</span>
              )}
            </span>
          }
        />
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
