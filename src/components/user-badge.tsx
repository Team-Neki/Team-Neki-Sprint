import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type MiniUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
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
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Avatar className={avatarSize}>
        {user.image && <AvatarImage src={user.image} alt={user.name ?? ""} />}
        <AvatarFallback className="text-[10px]">
          {initialsOf(user)}
        </AvatarFallback>
      </Avatar>
      {!hideName && (
        <span className="truncate text-xs">{user.name ?? user.email}</span>
      )}
    </span>
  );
}
