import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { ko } from "date-fns/locale";
import type { Status } from "@prisma/client";
import { getDashboardData } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/badges";
import { UserBadge } from "@/components/user-badge";
import { STATUS_ORDER, STATUS_META } from "@/lib/constants";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  created: "생성",
  updated: "수정",
  deleted: "삭제",
  status_changed: "상태 변경",
  commented: "댓글",
};
const ENTITY_LABEL: Record<string, string> = {
  initiative: "이니셔티브",
  epic: "에픽",
  task: "태스크",
  wiki: "위키",
};

export default async function DashboardPage() {
  const { statusCounts, totalTasks, myTasks, recentActivity, initiatives } =
    await getDashboardData();

  const countByStatus = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count]),
  ) as Record<Status, number>;

  return (
    <div>
      <PageHeader
        title="대시보드"
        description="팀의 진행 상황을 한눈에 확인하세요."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATUS_ORDER.map((s) => (
          <Card key={s}>
            <CardContent className="py-4">
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${STATUS_META[s].dot}`} />
                <span className="text-muted-foreground text-xs">
                  {STATUS_META[s].label}
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {countByStatus[s] ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">다가오는 마감</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {myTasks.length === 0 && (
              <p className="text-muted-foreground py-6 text-center text-sm">
                예정된 마감이 없습니다.
              </p>
            )}
            {myTasks.map((t) => (
              <Link
                key={t.id}
                href={`/tasks/${t.id}`}
                className="hover:bg-accent/60 flex items-center gap-3 rounded-md px-2 py-2"
              >
                <StatusBadge status={t.status} />
                <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                {t.dueDate && (
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {format(t.dueDate, "M월 d일", { locale: ko })}
                  </span>
                )}
                <UserBadge user={t.assignee} hideName size="xs" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">진행 중 이니셔티브</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {initiatives.length === 0 && (
              <p className="text-muted-foreground py-6 text-center text-sm">
                이니셔티브가 없습니다.
              </p>
            )}
            {initiatives.map((i) => (
              <Link
                key={i.id}
                href={`/initiatives/${i.id}`}
                className="hover:bg-accent/60 flex items-center gap-2 rounded-md px-2 py-2"
              >
                <StatusBadge status={i.status} />
                <span className="min-w-0 flex-1 truncate text-sm">{i.title}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  에픽 {i._count.epics}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">최근 활동</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {recentActivity.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              아직 활동 기록이 없습니다.
            </p>
          )}
          {recentActivity.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-sm">
              <UserBadge user={a.user} hideName size="xs" />
              <span className="text-muted-foreground">
                <span className="text-foreground font-medium">
                  {a.user?.name ?? a.user?.email ?? "누군가"}
                </span>{" "}
                님이 {ENTITY_LABEL[a.entityType] ?? a.entityType}
                {typeof a.meta === "object" && a.meta && "title" in a.meta
                  ? ` “${(a.meta as { title?: string }).title}”`
                  : ""}{" "}
                {ACTION_LABEL[a.action] ?? a.action}
              </span>
              <span className="text-muted-foreground/70 ml-auto shrink-0 text-xs">
                {formatDistanceToNow(a.createdAt, { addSuffix: true, locale: ko })}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
