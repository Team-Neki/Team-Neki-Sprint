import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Megaphone } from "lucide-react";
import type { Status } from "@prisma/client";
import { getDashboardData, getAnnouncements, getProjects, getSprints } from "@/server/queries";
import { getDashboardSchedule } from "@/server/dashboard-schedule";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { DashboardSchedule } from "@/components/dashboard/schedule";
import { TaskProgressCell } from "@/components/detail/task-progress";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/badges";
import { UserBadge } from "@/components/user-badge";
import { NewAnnouncementButton } from "@/components/announcements/new-announcement-button";
import { STATUS_ORDER, STATUS_META } from "@/lib/constants";
import { buildLookups, activityDescription } from "@/lib/activity-format";
import { getScheduleWindow, scheduleDate, scheduleToday, type ScheduleItem } from "@/lib/dashboard-schedule";

export const dynamic = "force-dynamic";
export const metadata = { title: "대시보드" };

const ENTITY_LABEL: Record<string, string> = {
  sprint: "스프린트",
  project: "프로젝트",
  team: "팀",
  epic: "에픽",
  task: "태스크",
  wiki: "위키",
};
const ENTITY_PATH: Record<string, string> = {
  sprint: "/sprints",
  project: "/projects",
  epic: "/epics",
  task: "/tasks",
  wiki: "/wiki",
};
function entityHref(entityType: string, entityId: string): string | null {
  if (entityType === "team") return "/teams";
  const base = ENTITY_PATH[entityType];
  return base ? `${base}/${entityId}` : null;
}
function ellipsize(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function displayPeriod(start: Date | null, end: Date | null) {
  const text = (date: Date) => scheduleDate(date).replaceAll("-", ".");
  if (start && end) return `${text(start)} – ${text(end)}`;
  if (start) return `시작 ${text(start)}`;
  if (end) return `마감 ${text(end)}`;
  return "일정 미설정";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; date?: string | string[]; ganttPage?: string | string[] }>;
}) {
  const user = await requireUser();
  const today = scheduleToday(new Date());
  const query = await searchParams;
  const schedule = getScheduleWindow(query, today);
  // 공지 스위치(announcements/layout.tsx 와 같은 조건). 꺼져 있으면 카드·조회 모두 생략.
  const showAnnouncements = process.env.ANNOUNCEMENTS_ENABLED === "true";
  const [
    { statusCounts, recentActivity, activityLookups },
    announcements,
    sprints,
    projects,
    scheduleItems,
  ] = await Promise.all([
    getDashboardData(user.id),
    showAnnouncements ? getAnnouncements(5) : [],
    getSprints({ status: ["ACTIVE", "PLANNED"] }),
    getProjects({ status: ["IN_PROGRESS"] }),
    getDashboardSchedule(schedule.days[0], schedule.days.at(-1)!),
  ]);
  const lookups = buildLookups(activityLookups);
  const activeSprints = sprints.filter((s) => s.status === "ACTIVE");
  const plannedSprints = sprints.filter(
    (s) => s.status === "PLANNED" &&
      (!s.endDate ? !s.startDate || scheduleDate(s.startDate) >= today : scheduleDate(s.endDate) >= today),
  );
  const nextSprint = plannedSprints
    .sort((a, b) =>
      ((a.startDate ?? a.endDate)?.getTime() ?? Number.MAX_SAFE_INTEGER) -
      ((b.startDate ?? b.endDate)?.getTime() ?? Number.MAX_SAFE_INTEGER),
    )[0];
  const unscheduledSprints = [...activeSprints, ...(nextSprint ? [nextSprint] : [])]
    .filter((s) => !s.startDate && !s.endDate);
  const undated: ScheduleItem[] = [
    ...unscheduledSprints.map((s) => ({
      id: s.id, title: s.name, kind: "sprint" as const, status: s.status, start: null, end: null,
    })),
    ...projects.filter((p) => !p.startDate && !p.dueDate).map((p) => ({
      id: p.id, title: p.title, kind: "project" as const, status: p.status, start: null, end: null,
    })),
  ];

  const countByStatus = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count]),
  ) as Record<Status, number>;

  return (
    <div>
      <PageHeader title="대시보드" />

      {/* 공지: 전원이 봐야 하는 정보라 대시보드 최상단에 두고, 인셋 헤더 밴드 +
          잉크 아이콘으로 다른 카드보다 한 단계 강조한다(새 액센트 색은 도입하지
          않음 — DESIGN.md). */}
      {showAnnouncements && (
        <Card className="mb-4 gap-0 pb-0">
          <CardHeader className="border-b pb-3">
            <CardTitle className="flex items-center gap-2 font-semibold">
              <Megaphone className="size-4" aria-hidden /> 공지
            </CardTitle>
            <CardAction className="flex items-center gap-3">
              <Link
                href="/announcements"
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                전체 보기
              </Link>
              <NewAnnouncementButton />
            </CardAction>
          </CardHeader>
          <CardContent className="bg-muted/40 flex flex-col gap-0.5 py-2">
            {announcements.length === 0 && (
              <p className="text-muted-foreground py-4 text-center text-sm">
                등록된 공지가 없습니다. 첫 공지를 작성해 보세요.
              </p>
            )}
            {announcements.map((a) => (
              <Link
                key={a.id}
                href={`/announcements/${a.id}`}
                className="hover:bg-accent/60 flex items-center gap-3 rounded-md px-2 py-2"
              >
                <span className="bg-foreground size-1.5 shrink-0 rounded-full" />
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
      )}

      <DashboardSchedule schedule={schedule} items={scheduleItems} undated={undated} today={today} ganttPage={query.ganttPage}>
        <nav aria-label="태스크 상태 요약" className="mt-3 flex flex-wrap items-center gap-y-1">
          {STATUS_ORDER.map((s) => (
            <Link key={s} href={`/tasks?status=${s}`} className="hover:bg-accent/60 inline-flex min-h-8 items-center gap-2 border-r px-3 text-sm last:border-r-0">
              <span className="text-muted-foreground">{STATUS_META[s].label}</span>
              <span className="font-semibold tabular-nums">{countByStatus[s] ?? 0}</span>
            </Link>
          ))}
        </nav>
      </DashboardSchedule>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card className="min-w-0 gap-2">
          <CardHeader>
            <CardTitle><h2>진행 중 스프린트</h2></CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {!activeSprints.length && (
              <p className="text-muted-foreground">진행 중인 스프린트 없음</p>
            )}
            {activeSprints.map((s) => (
              <Link
                key={s.id}
                href={`/sprints/${s.id}`}
                className="hover:bg-accent/60 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-2 py-2"
              >
                <span className="min-w-0 font-medium">{s.name}</span>
                <span className="text-muted-foreground text-xs">{displayPeriod(s.startDate, s.endDate)}</span>
                <TaskProgressCell progress={s.progress} />
              </Link>
            ))}
            {nextSprint && (
              <Link href={`/sprints/${nextSprint.id}`} className="hover:bg-accent/60 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-2">
                <span className="size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
                <span className="min-w-0 flex-1 font-medium">{nextSprint.name}</span>
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">예정</span>
                <span className="text-muted-foreground text-xs">{displayPeriod(nextSprint.startDate, nextSprint.endDate)}</span>
              </Link>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 gap-2">
          <CardHeader>
            <CardTitle><h2>진행 중 프로젝트</h2></CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {projects.length === 0 && (
              <p className="text-muted-foreground">
                진행 중인 프로젝트 없음
              </p>
            )}
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="hover:bg-accent/60 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-2 py-2"
              >
                <StatusBadge status={p.status} />
                <span className="min-w-0 flex-1 font-medium">{p.title}</span>
                <span className="text-muted-foreground text-xs">{displayPeriod(p.startDate, p.dueDate)}</span>
                <TaskProgressCell progress={p.progress} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 gap-2">
        <CardHeader>
          <CardTitle><h2>최근 활동</h2></CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {recentActivity.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              아직 활동 기록이 없습니다.
            </p>
          )}
          {recentActivity.map((a) => {
            const href = entityHref(a.entityType, a.entityId);
            const title = a.entityTitle ?? undefined;
            const body = (
              <>
                <UserBadge user={a.user} hideName size="xs" />
                <span className="text-muted-foreground min-w-0 flex-1 truncate">
                  <span className="text-foreground font-medium">
                    {a.user?.name ?? a.user?.email ?? "누군가"}
                  </span>{" "}
                  님이 {ENTITY_LABEL[a.entityType] ?? a.entityType}
                  {title ? (
                    <span className="text-foreground"> “{ellipsize(title, 40)}”</span>
                  ) : null}
                  {a.entityKey ? (
                    <span className="text-muted-foreground ml-1 font-mono text-xs">
                      ({a.entityKey})
                    </span>
                  ) : null}{" "}
                  {activityDescription(a.action, a.meta, lookups)}
                </span>
                <span className="text-muted-foreground/70 ml-auto shrink-0 text-xs">
                  {formatDistanceToNow(a.createdAt, {
                    addSuffix: true,
                    locale: ko,
                  })}
                </span>
              </>
            );
            return href ? (
              <Link
                key={a.id}
                href={href}
                className="hover:bg-accent/60 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                {body}
              </Link>
            ) : (
              <div
                key={a.id}
                className="flex items-center gap-2 px-2 py-1.5 text-sm"
              >
                {body}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
