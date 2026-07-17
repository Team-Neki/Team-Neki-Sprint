import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Megaphone } from "lucide-react";
import { getAnnouncements } from "@/server/queries";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { UserBadge } from "@/components/user-badge";
import { NewAnnouncementButton } from "@/components/announcements/new-announcement-button";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  await requireUser();
  const announcements = await getAnnouncements();

  return (
    <div>
      <PageHeader title="공지" description="팀 전체에 공유하는 공지사항입니다.">
        <NewAnnouncementButton />
      </PageHeader>

      <Card>
        <CardContent className="flex flex-col gap-1">
          {announcements.length === 0 && (
            <p className="text-muted-foreground py-10 text-center text-sm">
              등록된 공지가 없습니다. 첫 공지를 작성해 보세요.
            </p>
          )}
          {announcements.map((a) => (
            <Link
              key={a.id}
              href={`/announcements/${a.id}`}
              className="hover:bg-accent/60 flex items-center gap-3 rounded-md px-2 py-2.5"
            >
              <Megaphone
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {a.title}
              </span>
              <UserBadge user={a.author} size="xs" />
              <span className="text-muted-foreground shrink-0 text-xs">
                {formatDistanceToNow(a.createdAt, {
                  addSuffix: true,
                  locale: ko,
                })}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
