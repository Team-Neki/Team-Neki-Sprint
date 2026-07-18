import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, Pencil, Phone } from "lucide-react";
import type { Status } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { getUserProfile } from "@/server/queries";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BackButton } from "@/components/detail/back-button";
import { ProfileDialog } from "@/components/forms/profile-dialog";
import { TokenManager } from "@/components/settings/token-manager";
import { initialsOf } from "@/components/user-badge";
import { STATUS_META, formatIssueKey } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ProfileItem = {
  id: string;
  number: number;
  title: string;
  status: Status;
  team: { key: string } | null;
};

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await requireUser();
  const { id } = await params;
  const user = await getUserProfile(id);
  if (!user) notFound();

  const label = user.name ?? user.email;
  const isSelf = currentUser.id === user.id;

  // 본인 프로필에서만 MCP 개인 API 토큰을 발급/폐기한다.
  const apiTokens = isSelf
    ? await prisma.apiToken.findMany({
        where: { userId: currentUser.id, revokedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          prefix: true,
          lastUsedAt: true,
          createdAt: true,
        },
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton fallback="/dashboard" label="뒤로 가기" />

      <div className="mt-3 flex items-center gap-4">
        <Avatar className="size-16">
          {user.image && <AvatarImage src={user.image} alt={label} />}
          <AvatarFallback className="text-lg">
            {initialsOf(user)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {label}
          </h1>
          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            {user.team ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ background: user.team.color ?? "#a3a3a3" }}
                />
                {user.team.name}
              </span>
            ) : (
              <span>팀 미배정</span>
            )}
            <span className="text-muted-foreground/50">·</span>
            <span>{user.role === "ADMIN" ? "관리자" : "멤버"}</span>
          </div>
        </div>
        {isSelf && (
          <ProfileDialog
            profile={{ name: user.name, phone: user.phone }}
            trigger={
              <Button variant="outline" size="sm" className="shrink-0">
                <Pencil className="size-4" />
                수정
              </Button>
            }
          />
        )}
      </div>

      <Card className="mt-6 gap-0 divide-y p-0">
        <InfoRow icon={<Mail className="size-4" />} label="이메일">
          <a
            href={`mailto:${user.email}`}
            className="text-link hover:underline"
          >
            {user.email}
          </a>
        </InfoRow>
        <InfoRow icon={<Phone className="size-4" />} label="연락처">
          {user.phone ? (
            <a href={`tel:${user.phone}`} className="text-link hover:underline">
              {user.phone}
            </a>
          ) : (
            <span className="text-muted-foreground">미등록</span>
          )}
        </InfoRow>
      </Card>

      <ItemSection
        title="오너 에픽"
        empty="오너인 에픽이 없어요"
        items={user.ownedEpics}
        hrefBase="/epics"
      />
      <ItemSection
        title="담당 태스크"
        empty="담당 중인 태스크가 없어요"
        items={user.assignedTasks}
        hrefBase="/tasks"
      />

      {isSelf && (
        <section className="mt-8">
          <h2 className="text-sm font-medium">API 토큰</h2>
          <p className="text-muted-foreground mt-1 mb-3 text-sm">
            MCP 연동에 사용할 개인 토큰입니다. 생성 시 한 번만 표시되니 안전하게
            보관하세요.
          </p>
          <TokenManager tokens={apiTokens} />
        </section>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-sm">
      <span className="text-muted-foreground flex w-20 shrink-0 items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function ItemSection({
  title,
  empty,
  items,
  hrefBase,
}: {
  title: string;
  empty: string;
  items: ProfileItem[];
  hrefBase: string;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-medium">
        {title} <span className="text-muted-foreground">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <Card className="gap-0 divide-y p-0">
          {items.map((it) => (
            <Link
              key={it.id}
              href={`${hrefBase}/${it.id}`}
              className="hover:bg-accent flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  STATUS_META[it.status].dot,
                )}
              />
              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                {formatIssueKey(it.team?.key, it.number)}
              </span>
              <span className="min-w-0 truncate">{it.title}</span>
            </Link>
          ))}
        </Card>
      )}
    </section>
  );
}
