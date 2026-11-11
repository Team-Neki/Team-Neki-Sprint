import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, ChartGantt, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { SPRINT_STATUS_META, STATUS_META } from "@/lib/constants";
import {
  getCalendarWeekItems,
  getGanttPage,
  getVisibleScheduleSpan,
  scheduleHref,
  scheduleWeekday,
  type ScheduleItem,
  type ScheduleView,
  type ScheduleWindow,
} from "@/lib/dashboard-schedule";
import { cn } from "@/lib/utils";
import { ScheduleDisplay } from "./schedule-display";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const dayNumber = (date: string) => Number(date.slice(8, 10));
const monthNumber = (date: string) => Number(date.slice(5, 7));
const dayLabel = (date: string) => `${monthNumber(date)}월 ${dayNumber(date)}일`;
const periodHref = (view: ScheduleView, date: string) =>
  `/dashboard?view=${view}&date=${date}`;
const weekendColor = (weekday: number) =>
  weekday === 0 ? "text-destructive" : weekday === 6 ? "text-blue-600 dark:text-blue-400" : "";

function periodLabel({ first, last, view }: ScheduleWindow) {
  const year = `${first.slice(0, 4)}년`;
  if (view === "calendar") return `${year} ${monthNumber(first)}월`;
  const end = first.slice(0, 7) === last.slice(0, 7)
    ? `${dayNumber(last)}일`
    : `${first.slice(0, 4) === last.slice(0, 4) ? "" : `${last.slice(0, 4)}년 `}${dayLabel(last)}`;
  return `${year} ${dayLabel(first)} – ${end}`;
}

function timelineMonthLabel(first: string, last: string) {
  const start = `${first.slice(0, 4)}년 ${monthNumber(first)}월`;
  if (first.slice(0, 7) === last.slice(0, 7)) return start;
  const endYear = first.slice(0, 4) === last.slice(0, 4) ? "" : `${last.slice(0, 4)}년 `;
  return `${start} – ${endYear}${monthNumber(last)}월`;
}

export function DashboardSchedule({
  schedule,
  items,
  undated,
  today,
  ganttPage,
  children,
}: {
  schedule: ScheduleWindow;
  items: ScheduleItem[];
  undated: ScheduleItem[];
  today: string;
  ganttPage?: string | string[];
  children: ReactNode;
}) {
  const { view, anchor, previous, next } = schedule;
  const period = periodLabel(schedule);
  return (
    <Card className="min-w-0 gap-2">
      <CardHeader>
        <CardTitle><h2>일정</h2></CardTitle>
      </CardHeader>
      <CardContent>
        <ScheduleDisplay
          views={
            <nav aria-label="일정 보기" className="flex gap-1">
              {([
                { value: "calendar", label: "캘린더", icon: CalendarDays },
                { value: "gantt", label: "간트 차트", icon: ChartGantt },
              ] as const).map(({ value, label, icon: Icon }) => (
                <Link
                  key={value}
                  href={periodHref(value, anchor)}
                  scroll={false}
                  prefetch={false}
                  aria-current={value === view ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring -mb-px inline-flex min-h-9 items-center gap-2 border-b-2 px-3 text-sm font-medium outline-none focus-visible:ring-2",
                    value === view
                      ? "border-blue-500 text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border-transparent",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              ))}
            </nav>
          }
        >
          <div className="my-3 flex flex-wrap items-center justify-between gap-2">
            {view === "gantt" && (
              <h3 className="text-sm font-semibold tabular-nums sm:text-base" aria-label={period}>
                {timelineMonthLabel(schedule.first, schedule.last)}
              </h3>
            )}
            <nav aria-label="일정 기간" className={cn("flex flex-wrap items-center gap-2", view === "gantt" && "ml-auto gap-0.5")}>
              <Link href={periodHref(view, previous)} scroll={false} prefetch={false} aria-label={view === "gantt" ? "이전 2주" : "이전 달"} className={buttonVariants({ variant: view === "gantt" ? "ghost" : "outline", size: "icon" })}>
                <ChevronLeft aria-hidden />
              </Link>
              {view === "calendar" && <h3 className="px-1 text-sm font-semibold tabular-nums sm:text-base">{period}</h3>}
              {view === "gantt" && (
                <Link href={periodHref(view, today)} scroll={false} prefetch={false} className={buttonVariants({ variant: "ghost" })}>오늘</Link>
              )}
              <Link href={periodHref(view, next)} scroll={false} prefetch={false} aria-label={view === "gantt" ? "다음 2주" : "다음 달"} className={buttonVariants({ variant: view === "gantt" ? "ghost" : "outline", size: "icon" })}>
                <ChevronRight aria-hidden />
              </Link>
              {view === "calendar" && (
                <Link href={periodHref(view, today)} scroll={false} prefetch={false} className={buttonVariants({ variant: "outline" })}>오늘</Link>
              )}
            </nav>
          </div>

          {view === "gantt" ? (
            <Gantt items={items} undated={undated} schedule={schedule} today={today} requestedPage={ganttPage} />
          ) : (
            <Calendar items={items} schedule={schedule} today={today} />
          )}
        </ScheduleDisplay>
        {children}
      </CardContent>
    </Card>
  );
}

const cell = "border-border border-b border-r last:border-r-0";
const scrollRegion = "focus-visible:ring-ring overflow-auto rounded-lg border outline-none focus-visible:ring-2";
const kindLabel = { sprint: "스프린트", project: "프로젝트", task: "태스크" };

function ScheduleProperties({ item }: { item: ScheduleItem }) {
  const status = item.kind === "sprint" ? SPRINT_STATUS_META[item.status] : STATUS_META[item.status];
  return (
    <span className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] leading-4">
      {item.team && (
        <span data-schedule-team className="text-foreground max-w-full wrap-break-word break-keep text-xs font-medium">
          팀: {item.team}
        </span>
      )}
      <span data-schedule-status className="inline-flex shrink-0 items-center gap-1">
        <span className={cn("size-1.5 rounded-full", status.dot)} aria-hidden />
        {status.label}
      </span>
    </span>
  );
}

function Gantt({
  items, undated, schedule, today, requestedPage,
}: {
  items: ScheduleItem[];
  undated: ScheduleItem[];
  schedule: ScheduleWindow;
  today: string;
  requestedPage?: string | string[];
}) {
  const { anchor, days, first } = schedule;
  const rows = items.flatMap((item) => {
    const span = getVisibleScheduleSpan(item, days);
    return span ? [{ item, span }] : [];
  });
  const { page, pageCount, start, end } = getGanttPage(requestedPage, rows.length);

  return (
    <>
      <div key={`${first}-${page}`} className="focus-visible:ring-ring h-64 overflow-auto outline-none focus-visible:ring-2" tabIndex={0} role="region" aria-label="간트 차트">
        <div className="flex min-h-full min-w-[952px] flex-col">
          <div className="bg-card sticky top-0 z-10 grid shrink-0 grid-cols-14 border-b pb-1 text-center">
            {days.map((date) => (
              <time
                key={date}
                dateTime={date}
                aria-label={`${dayLabel(date)} ${weekdays[scheduleWeekday(date)]}요일`}
                aria-current={date === today ? "date" : undefined}
                className={cn(
                  "text-muted-foreground mx-auto inline-flex size-7 items-center justify-center rounded-full text-sm tabular-nums",
                  date === today && "bg-red-600 font-semibold text-white dark:bg-red-500 dark:text-neutral-950",
                )}
              >
                {dayNumber(date)}
              </time>
            ))}
          </div>
          <div className="bg-muted/25 relative grow border-b">
            <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-14">
              {days.map((date) => (
                <div key={date} className={cn("relative", [0, 6].includes(scheduleWeekday(date)) && "bg-muted/65")}>
                  {date === today && (
                    <div className="absolute inset-y-0 left-1/2 w-px bg-red-500 before:absolute before:top-0 before:left-1/2 before:size-1.5 before:-translate-x-1/2 before:rounded-full before:bg-red-500" />
                  )}
                </div>
              ))}
            </div>
            {rows.length > 0 ? (
              <ul className="relative py-1" aria-label="기간 내 일정">
                {rows.slice(start, end).map(({ item, span }) => {
                  const dateText = span.milestone
                    ? `${dayLabel(span.range.first)} ${item.end ? (item.kind === "sprint" ? "종료" : "마감") : "시작"}`
                    : `${dayLabel(span.range.first)} – ${dayLabel(span.range.last)}`;
                  return (
                    <li key={`${item.kind}-${item.id}`} className="grid grid-cols-14">
                      <Link
                        href={scheduleHref(item)}
                        prefetch={false}
                        title={`${item.title} · ${dateText}`}
                        style={{ gridColumn: `${span.start + 1} / span ${span.count}` }}
                        className="bg-card hover:bg-accent focus-visible:ring-ring m-0.5 flex min-h-10 min-w-0 flex-col justify-center rounded-lg border border-border/80 px-2 py-1 text-sm leading-tight font-medium shadow-xs focus-visible:ring-2"
                      >
                        <span className="line-clamp-3 min-w-0 wrap-break-word break-keep">{item.title}</span>
                        <span className="sr-only"> · {kindLabel[item.kind]} · {dateText}</span>
                        <ScheduleProperties item={item} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground relative py-10 text-center text-sm">이 기간에 등록된 일정이 없습니다.</p>
            )}
          </div>
        </div>
      </div>
      {pageCount > 1 && (
        <nav aria-label="간트 일정 페이지" className="mt-2 flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
            {start + 1}–{end} / {rows.length}건
          </span>
          <div className="flex items-center gap-0.5">
            {[
              { target: page - 1, label: "이전 일정 목록", icon: ChevronLeft },
              { target: page + 1, label: "다음 일정 목록", icon: ChevronRight },
            ].map(({ target, label, icon: Icon }) => (
              target < 1 || target > pageCount ? (
                <Button key={label} variant="ghost" size="icon-sm" disabled aria-label={label}>
                  <Icon aria-hidden />
                </Button>
              ) : (
                <Link
                  key={label}
                  href={`${periodHref("gantt", anchor)}&ganttPage=${target}`}
                  scroll={false}
                  prefetch={false}
                  aria-label={label}
                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                >
                  <Icon aria-hidden />
                </Link>
              )
            ))}
          </div>
        </nav>
      )}
      {undated.length > 0 && (
        <div className="text-muted-foreground mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1 text-xs">
          <span>일정 미설정</span>
          <ul className="flex max-h-20 min-w-0 flex-wrap gap-x-3 gap-y-1 overflow-y-auto">
            {undated.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="min-w-0">
                <Link href={scheduleHref(item)} prefetch={false} className="text-foreground inline-flex flex-wrap items-center gap-x-2 wrap-break-word hover:underline">
                  <span className="min-w-0">{item.title}</span>
                  <ScheduleProperties item={item} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Calendar({
  items, schedule, today,
}: {
  items: ScheduleItem[];
  schedule: ScheduleWindow;
  today: string;
}) {
  const weeks = Array.from({ length: schedule.days.length / 7 }, (_, i) =>
    schedule.days.slice(i * 7, (i + 1) * 7),
  );
  return (
    <div className={scrollRegion} tabIndex={0} role="region" aria-label="월간 캘린더">
      <table className="w-full min-w-[630px] table-fixed border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {weekdays.map((day, i) => (
              <th key={day} scope="col" className={cn(cell, "bg-muted py-2 text-xs font-medium", weekendColor(i))}>{day}</th>
            ))}
          </tr>
        </thead>
        {weeks.map((week, weekIndex) => (
          <tbody key={week[0]}>
            <tr>
              {week.map((date) => (
                <td key={date} className={cn("border-r px-1.5 pt-1.5 pb-0.5 last:border-r-0", date.slice(0, 7) !== schedule.first.slice(0, 7) && "bg-muted/40")}>
                  <time dateTime={date} aria-label={dayLabel(date)} aria-current={date === today ? "date" : undefined} className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums", weekendColor(scheduleWeekday(date)), date === today && "bg-blue-500/15 font-semibold", date.slice(0, 7) !== schedule.first.slice(0, 7) && "text-muted-foreground")}>
                    {dayNumber(date)}
                  </time>
                </td>
              ))}
            </tr>
            <tr>
              <td colSpan={7} className={cn("relative border-b p-0 pb-2", weekIndex === weeks.length - 1 && "border-b-0")}>
                <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-7">
                  {week.map((date) => (
                    <div key={date} className={cn("border-r last:border-r-0", date.slice(0, 7) !== schedule.first.slice(0, 7) && "bg-muted/40")} />
                  ))}
                </div>
                <ul className="relative grid min-h-14 grid-cols-7 auto-rows-max gap-y-0.5" aria-label={`${dayLabel(week[0])} 주 일정`}>
                  {getCalendarWeekItems(items, week).map(({ item, span, lane }) => {
                    const dateText = span.milestone
                      ? dayLabel(span.range.first)
                      : `${dayLabel(span.range.first)} – ${dayLabel(span.range.last)}`;
                    return (
                      <li
                        key={`${item.kind}-${item.id}`}
                        style={{ gridColumn: `${span.start + 1} / span ${span.count}`, gridRow: lane + 1 }}
                        className="min-w-0 px-0.5"
                      >
                        <Link
                          href={scheduleHref(item)}
                          title={`${item.title} · ${dateText}`}
                          className={cn(
                            "bg-card hover:bg-accent focus-visible:ring-ring block min-w-0 rounded-md border border-border/80 px-1.5 py-1 text-xs shadow-xs focus-visible:ring-2",
                            span.range.first < week[0] && "rounded-l-none border-l-0",
                            span.range.last > week[6] && "rounded-r-none border-r-0",
                          )}
                        >
                          <span className="block truncate font-medium">{item.title}</span>
                          <span className="sr-only"> · {dateText}</span>
                          <ScheduleProperties item={item} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </td>
            </tr>
          </tbody>
        ))}
      </table>
    </div>
  );
}
