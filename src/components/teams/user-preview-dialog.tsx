"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Mail, Phone, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsOf, type MiniUser } from "@/components/user-badge";
import { getUserPreview } from "@/server/actions/users";

type Preview = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  phone: string | null;
  role: "ADMIN" | "MEMBER";
  team: { key: string; name: string; color: string | null } | null;
  _count: { assignedTasks: number; ownedEpics: number };
};

/**
 * 사용자 이름/아바타를 감싸 클릭 시 중앙 팝업으로 상세 요약을 띄운다(팀 페이지 등).
 * 열릴 때 getUserPreview 로 역할·연락처·담당/오너 개수를 지연 로드한다. 배경 블러 없음
 * (전역 Dialog 오버레이에서 backdrop-blur 제거됨).
 */
export function UserPreviewDialog({
  user,
  children,
}: {
  user: MiniUser;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Preview | null>(null);
  const [pending, start] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && !data) {
      start(async () => {
        const res = await getUserPreview(user.id);
        if (res) setData(res as Preview);
      });
    }
  }

  const label = data?.name ?? user.name ?? user.email;
  const team = data?.team ?? user.team ?? null;
  const roleLabel = data ? (data.role === "ADMIN" ? "관리자" : "멤버") : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="cursor-pointer rounded text-left hover:opacity-80"
          />
        }
      >
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="sr-only">사용자 정보</DialogTitle>

        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            {user.image && <AvatarImage src={user.image} alt={label} />}
            <AvatarFallback>{initialsOf(user)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{label}</div>
            <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
              {team ? (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: data?.team?.color ?? "#a3a3a3" }}
                  />
                  {team.name}
                </span>
              ) : (
                <span>팀 미배정</span>
              )}
              {roleLabel && (
                <>
                  <span className="text-muted-foreground/50">·</span>
                  <span>{roleLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-border flex flex-col gap-2 border-t pt-3 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="text-muted-foreground size-4 shrink-0" />
            <a href={`mailto:${user.email}`} className="text-link truncate hover:underline">
              {user.email}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="text-muted-foreground size-4 shrink-0" />
            {data?.phone ? (
              <a href={`tel:${data.phone}`} className="text-link hover:underline">
                {data.phone}
              </a>
            ) : (
              <span className="text-muted-foreground">
                {pending ? "불러오는 중…" : "연락처 미등록"}
              </span>
            )}
          </div>
        </div>

        <div className="text-muted-foreground flex gap-4 text-xs">
          <span>
            담당 태스크{" "}
            <span className="text-foreground font-medium">
              {data?._count.assignedTasks ?? "–"}
            </span>
          </span>
          <span>
            오너 에픽{" "}
            <span className="text-foreground font-medium">
              {data?._count.ownedEpics ?? "–"}
            </span>
          </span>
        </div>

        <Link
          href={`/users/${user.id}`}
          className="text-link inline-flex items-center gap-1 text-sm hover:underline"
        >
          전체 프로필 보기 <ArrowUpRight className="size-3.5" />
        </Link>
      </DialogContent>
    </Dialog>
  );
}
