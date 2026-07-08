"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  getDay,
  isSameDay,
  max as maxDate,
  min as minDate,
  startOfDay,
} from "date-fns";
import { ko } from "date-fns/locale";
import type { Status, Priority } from "@prisma/client";
import { STATUS_META, formatIssueKey } from "@/lib/constants";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import { cn } from "@/lib/utils";

type TimelineTask = {
  id: string;
  number: number;
  title: string;
  status: Status;
  startDate: Date | null;
  dueDate: Date | null;
  team: { key: string } | null;
  assignee: MiniUser | null;
};

export type TimelineEpic = {
  id: string;
  number: number;
  title: string;
  status: Status;
  priority: Priority;
  startDate: Date | null;
  dueDate: Date | null;
  owner: MiniUser | null;
  team: { id: string; key: string; name: string; color?: string | null } | null;
  project: { id: string; title: string } | null;
  tasks: TimelineTask[];
};

type Range = { start: Date; end: Date } | null;

// Layout constants. NAME_W must match the `w-64` name gutter (16rem = 256px).
const NAME_W = 256;
// Each date is a fixed-width day cell. Day width fills toward TARGET_RULER_PX but
// is clamped to [DAY_W_MIN, DAY_W_MAX]: long ranges floor at the min (cells stay
// readable, container widens → horizontal scroll), short ranges cap at the max.
const DAY_W_MIN = 28;
const DAY_W_MAX = 40;
const TARGET_RULER_PX = 900;
const MIN_BAR_PX = 6;
// Week-start date labels only; drop any that would collide with the leading label.
const LABEL_MIN_GAP_PX = 44;

function datesOf(epic: TimelineEpic): Date[] {
  const ds: (Date | null)[] = [epic.startDate, epic.dueDate];
  for (const t of epic.tasks) ds.push(t.startDate, t.dueDate);
  return ds.filter((d): d is Date => d != null).map((d) => new Date(d));
}

function rangeOf(epic: TimelineEpic): Range {
  const ds = datesOf(epic);
  if (!ds.length) return null;
  return { start: minDate(ds), end: maxDate(ds) };
}

function taskRange(t: TimelineTask): Range {
  const s = t.startDate ?? t.dueDate;
  const e = t.dueDate ?? t.startDate;
  if (!s || !e) return null;
  return { start: new Date(s), end: new Date(e) };
}

export function EpicTimeline({
  epics,
  today,
}: {
  epics: TimelineEpic[];
  today: Date;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const base = startOfDay(new Date(today));

  // Global window across every epic/task date, resolved to per-day columns.
  const { start, totalDays, dayWidth, rulerWidth, dayList, labels } = useMemo(() => {
    const all = epics.flatMap(datesOf);
    const rangeStart = all.length
      ? minDate([...all, addDays(base, -3)])
      : addDays(base, -3);
    const rangeEnd = all.length
      ? maxDate([...all, addDays(base, 21)])
      : addDays(base, 21);
    const s = startOfDay(rangeStart);
    const e = startOfDay(rangeEnd);
    const days = Math.max(differenceInCalendarDays(e, s) + 1, 14);
    const width = Math.min(
      DAY_W_MAX,
      Math.max(DAY_W_MIN, Math.round(TARGET_RULER_PX / days)),
    );
    const list = eachDayOfInterval({ start: s, end: addDays(s, days - 1) });

    // Labels on week starts (Mon) plus the leading day, thinned so adjacent
    // labels never collide. Weekly spacing is >= 7 * DAY_W_MIN (196px), so only
    // the leading-vs-first-Monday pair can ever be close enough to drop.
    const lbls: { index: number; date: Date }[] = [];
    let lastPx = -Infinity;
    list.forEach((d, i) => {
      if (i !== 0 && getDay(d) !== 1) return;
      const px = i * width;
      if (px - lastPx < LABEL_MIN_GAP_PX) return;
      lbls.push({ index: i, date: d });
      lastPx = px;
    });

    return {
      start: s,
      totalDays: days,
      dayWidth: width,
      rulerWidth: days * width,
      dayList: list,
      labels: lbls,
    };
  }, [epics, base]);

  const dayIndex = (d: Date) =>
    differenceInCalendarDays(startOfDay(d), start);
  const leftPx = (d: Date) => Math.max(dayIndex(d), 0) * dayWidth;
  const spanPx = (r: { start: Date; end: Date }) => {
    const l = leftPx(r.start);
    const right = (dayIndex(r.end) + 1) * dayWidth;
    return Math.max(right - l, MIN_BAR_PX);
  };
  const todayIndex = dayIndex(base);

  // Group epics under their project, preserving order.
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { title: string; epics: TimelineEpic[] }
    >();
    for (const e of epics) {
      const key = e.project?.id ?? "__none__";
      const title = e.project?.title ?? "프로젝트 없음";
      if (!map.has(key)) map.set(key, { title, epics: [] });
      map.get(key)!.epics.push(e);
    }
    return [...map.values()];
  }, [epics]);

  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width: NAME_W + rulerWidth }}>
        {/* Day header — week-start labels (bold), day cells act as ticks below.
            Full width (incl. name gutter) so a sticky mask can keep labels from
            bleeding under the frozen name column during horizontal scroll. */}
        <div
          className="text-muted-foreground relative mb-2 h-5 border-b text-[11px]"
          style={{ width: NAME_W + rulerWidth }}
        >
          {/* sticky gutter mask over the frozen name column */}
          <div
            className="bg-card sticky left-0 z-30 h-full border-b"
            style={{ width: NAME_W }}
          />
          {labels.map(({ index, date }) => (
            <span
              key={index}
              className="absolute bottom-0.5 whitespace-nowrap font-semibold"
              style={{ left: NAME_W + index * dayWidth + 2 }}
            >
              {format(date, "M/d", { locale: ko })}
            </span>
          ))}
        </div>

        <div className="relative">
          {/* Day-cell grid: weekend/today shading + week gridlines, spans all rows */}
          <div
            className="pointer-events-none absolute inset-y-0"
            style={{ left: NAME_W, width: rulerWidth }}
          >
            {dayList.map((d, i) => {
              const dow = getDay(d);
              const isWeekend = dow === 0 || dow === 6;
              const isWeekStart = dow === 1;
              const isToday = isSameDay(d, base);
              return (
                <div
                  key={i}
                  className={cn(
                    "absolute inset-y-0 border-l",
                    isWeekStart ? "border-border" : "border-border/40",
                    isToday
                      ? "bg-red-500/5"
                      : isWeekend
                        ? "bg-muted/60"
                        : undefined,
                  )}
                  style={{ left: i * dayWidth, width: dayWidth }}
                />
              );
            })}
          </div>

          {/* Today marker */}
          {todayIndex >= 0 && todayIndex < totalDays && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500"
              style={{ left: NAME_W + todayIndex * dayWidth }}
            />
          )}

          <div className="flex flex-col gap-4">
            {groups.map((g, gi) => (
              <div key={gi} className="flex flex-col gap-1">
                <p
                  className="bg-card text-muted-foreground sticky left-0 z-20 w-64 shrink-0 truncate pl-1 text-xs font-medium"
                  title={g.title}
                >
                  {g.title}
                </p>
                {g.epics.map((epic) => {
                  const r = rangeOf(epic);
                  const isOpen = expanded.has(epic.id);
                  const hasTasks = epic.tasks.length > 0;
                  return (
                    <div key={epic.id} className="flex flex-col">
                      {/* Epic row */}
                      <div className="flex items-center">
                        <div className="bg-card sticky left-0 z-20 flex w-64 shrink-0 items-center gap-1 self-stretch pr-3">
                          <button
                            type="button"
                            onClick={() => toggle(epic.id)}
                            className={cn(
                              "text-muted-foreground shrink-0 rounded p-0.5 hover:bg-accent",
                              !hasTasks && "invisible",
                            )}
                            aria-label="펼치기"
                          >
                            <ChevronRight
                              className={cn(
                                "size-3.5 transition-transform",
                                isOpen && "rotate-90",
                              )}
                            />
                          </button>
                          <Link
                            href={`/epics/${epic.id}`}
                            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                            title={epic.title}
                          >
                            <span className="text-muted-foreground font-mono text-[11px]">
                              {formatIssueKey(epic.team?.key, epic.number)}
                            </span>{" "}
                            {epic.title}
                          </Link>
                          <UserBadge user={epic.owner} hideName size="xs" />
                        </div>
                        <div
                          className="relative h-7 shrink-0"
                          style={{ width: rulerWidth }}
                        >
                          {r ? (
                            <Link
                              href={`/epics/${epic.id}`}
                              className={cn(
                                "absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-[11px] font-medium text-white shadow-sm",
                                STATUS_META[epic.status].dot,
                              )}
                              style={{ left: leftPx(r.start), width: spanPx(r) }}
                            >
                              <span className="min-w-0 truncate">
                                {epic.tasks.length > 0
                                  ? `${epic.tasks.length} 태스크`
                                  : format(r.end, "M/d", { locale: ko })}
                              </span>
                            </Link>
                          ) : (
                            <span className="text-muted-foreground/60 absolute top-1/2 left-1 -translate-y-1/2 text-[11px]">
                              일정 미설정
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Task sub-rows */}
                      {isOpen &&
                        epic.tasks.map((t) => {
                          const tr = taskRange(t);
                          return (
                            <div key={t.id} className="flex items-center">
                              <div className="bg-card sticky left-0 z-20 flex w-64 shrink-0 items-center gap-1.5 self-stretch py-0.5 pr-3 pl-7">
                                <Link
                                  href={`/tasks/${t.id}`}
                                  className="text-muted-foreground min-w-0 flex-1 truncate text-xs hover:underline"
                                  title={t.title}
                                >
                                  {t.title}
                                </Link>
                                <UserBadge user={t.assignee} hideName size="xs" />
                              </div>
                              <div
                                className="relative h-6 shrink-0"
                                style={{ width: rulerWidth }}
                              >
                                {tr && (
                                  <Link
                                    href={`/tasks/${t.id}`}
                                    className={cn(
                                      "absolute top-1/2 h-3.5 -translate-y-1/2 rounded-sm opacity-80",
                                      STATUS_META[t.status].dot,
                                    )}
                                    style={{
                                      left: leftPx(tr.start),
                                      width: spanPx(tr),
                                    }}
                                    title={`${t.title} · ${format(tr.end, "M/d", { locale: ko })}`}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
