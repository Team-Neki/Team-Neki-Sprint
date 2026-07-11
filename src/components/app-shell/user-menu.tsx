"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  id,
  name,
  email,
  image,
  onSignOut,
}: {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  onSignOut: () => Promise<void>;
}) {
  const initials =
    name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-9 gap-2 pr-2 pl-1" />}
      >
        <Avatar className="size-7">
          {image && <AvatarImage src={image} alt={name} />}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-28 truncate text-sm sm:inline">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* GroupLabel 은 Base UI 상 반드시 Group 안에 있어야 한다(밖이면
            MenuGroupContext missing 오류 → 메뉴 크래시). 프로필 라벨을 Group 으로 감싼다. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="truncate">{name}</span>
            <span className="text-muted-foreground truncate text-xs font-normal">
              {email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href={`/users/${id}`} className="cursor-pointer" />}
        >
          <UserRound className="size-4" />
          내 정보
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={onSignOut}>
          <DropdownMenuItem
            nativeButton
            render={<button type="submit" className="w-full cursor-pointer" />}
          >
            <LogOut className="size-4" />
            로그아웃
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
