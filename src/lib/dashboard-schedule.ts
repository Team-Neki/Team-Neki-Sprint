import type { SprintStatus, Status } from "@prisma/client";

export type ScheduleView = "calendar" | "gantt";

export type ScheduleItem = {
  id: string;
  title: string;
  team?: string;
  start: string | null;
  end: string | null;
} & (
  | { kind: "sprint"; status: SprintStatus }
  | { kind: "project" | "task"; status: Status }
);

const DAY = 86_400_000;
const GANTT_DAYS = 14;
const GANTT_PAGE_SIZE = 20;
const dateFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Sprint dates are stored as date-only values at UTC midnight.
export const scheduleDate = (date: Date) => date.toISOString().slice(0, 10);
const fromDateKey = (key: string) => new Date(`${key}T00:00:00.000Z`);
export const scheduleToday = (now: Date) => dateFormat.format(now);
export const scheduleWeekday = (key: string) => fromDateKey(key).getUTCDay();

function addDays(key: string, days: number) {
  return scheduleDate(new Date(fromDateKey(key).getTime() + days * DAY));
}

function monthStart(key: string, offset = 0) {
  const date = fromDateKey(key);
  return scheduleDate(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1)),
  );
}

function validDate(key: unknown): key is string {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const year = Number(key.slice(0, 4));
  if (year < 1900 || year > 9998) return false;
  const date = fromDateKey(key);
  return Number.isFinite(date.getTime()) && scheduleDate(date) === key;
}

export function getScheduleWindow(
  query: { view?: unknown; date?: unknown },
  today: string,
) {
  const view: ScheduleView = query.view === "gantt" ? "gantt" : "calendar";
  const anchor = validDate(query.date) ? query.date : today;
  const isCalendar = view === "calendar";
  const first = isCalendar ? monthStart(anchor) : addDays(anchor, -((scheduleWeekday(anchor) + 6) % 7));
  const last = isCalendar ? addDays(monthStart(anchor, 1), -1) : addDays(first, GANTT_DAYS - 1);
  const gridStart = isCalendar ? addDays(first, -scheduleWeekday(first)) : first;
  const gridEnd = isCalendar ? addDays(last, 6 - scheduleWeekday(last)) : last;
  const days = [];
  for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) {
    days.push(day);
  }
  return {
    view,
    anchor,
    first,
    last,
    days,
    previous: isCalendar ? monthStart(anchor, -1) : addDays(anchor, -GANTT_DAYS),
    next: isCalendar ? monthStart(anchor, 1) : addDays(anchor, GANTT_DAYS),
  };
}

export type ScheduleWindow = ReturnType<typeof getScheduleWindow>;

export function getGanttPage(requested: unknown, itemCount: number) {
  const pageCount = Math.max(1, Math.ceil(itemCount / GANTT_PAGE_SIZE));
  const requestedPage = typeof requested === "string" && /^[1-9]\d*$/.test(requested)
    ? Number(requested)
    : 1;
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * GANTT_PAGE_SIZE;
  return { page, pageCount, start, end: Math.min(start + GANTT_PAGE_SIZE, itemCount) };
}

export function scheduleRange(item: ScheduleItem) {
  const { start, end } = item;
  const first = start ?? end;
  const last = end ?? start;
  return first && last && first <= last ? { first, last } : null;
}

export function getVisibleScheduleSpan(
  item: ScheduleItem,
  days: readonly string[],
) {
  const range = scheduleRange(item);
  if (!range) return null;
  const start = days.findIndex((day) => day >= range.first && day <= range.last);
  if (start === -1) return null;
  const count = days.slice(start).filter((day) => day <= range.last).length;
  return { start, count, range, milestone: range.first === range.last };
}

export function getCalendarWeekItems(items: readonly ScheduleItem[], days: readonly string[]) {
  const visible = items.flatMap((item) => {
    const span = getVisibleScheduleSpan(item, days);
    return span ? [{ item, span }] : [];
  }).sort((a, b) => a.span.start - b.span.start || b.span.count - a.span.count);
  const laneEnds: number[] = [];
  return visible.map(({ item, span }) => {
    const available = laneEnds.findIndex((end) => end < span.start);
    const lane = available === -1 ? laneEnds.length : available;
    laneEnds[lane] = span.start + span.count - 1;
    return { item, span, lane };
  });
}

export const scheduleHref = (item: ScheduleItem) =>
  `/${item.kind === "task" ? "tasks" : `${item.kind}s`}/${item.id}`;
