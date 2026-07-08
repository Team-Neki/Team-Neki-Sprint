import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import type { Status } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { getUserProfile } from "@/server/queries";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BackButton } from "@/components/detail/back-button";
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
  await requireUser();
  const { id } = await params;
  const user = await getUserProfile(id);
  if (!user) notFound();

  const label = user.name ?? user.email;

  return (
    <div className="mx-auto max-w-3xl">
      <BackButton fallback="/dashboard" label="대시보드" />

      <div className="mt-3 flex items-center gap-4">
        <Avatar className="size-16">
          {user.image && <AvatarImage src={user.image} alt={label} />}
          <AvatarFallback className="text-lg">
            {initialsOf(user)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
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
        title="담당 태스크"
        empty="담당 중인 태스크가 없어요"
        items={user.assignedTasks}
        hrefBase="/tasks"
      />
      <ItemSection
        title="오너 에픽"
        empty="오너인 에픽이 없어요"
        items={user.ownedEpics}
        hrefBase="/epics"
      />
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
