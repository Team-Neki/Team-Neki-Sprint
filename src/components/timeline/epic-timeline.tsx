"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  addDays,
  differenceInCalendarDays,
  eachWeekOfInterval,
  format,
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

  // Global window across every epic/task date.
  const { start, totalDays, weeks } = useMemo(() => {
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
    const wk = eachWeekOfInterval(
      { start: s, end: addDays(s, days - 1) },
      { weekStartsOn: 1 },
    );
    return { start: s, totalDays: days, weeks: wk };
  }, [epics, base]);

  const pct = (d: Date) =>
    (differenceInCalendarDays(startOfDay(d), start) / totalDays) * 100;
  const todayLeft = pct(base);

  // Density-based week-label thinning. Labels are absolutely positioned at
  // `left: pct(w)%` of the ruler, which starts after the ml-64 (256px) name
  // gutter. At the container's minimum width (min-w-[760px]) the ruler is
  // ~504px wide, so each week occupies (7 / totalDays) * 504 px. If adjacent
  // labels would sit closer than MIN_LABEL_PX we show only every Nth week
  // (index 0 always shown). Computed against the min width so it stays
  // collision-free when the timeline is scrolled at its narrowest.
  const labelStep = useMemo(() => {
    const RULER_MIN_PX = 760 - 256; // min-w-[760px] minus ml-64 name gutter
    const MIN_LABEL_PX = 44;
    const weekPx = (7 / totalDays) * RULER_MIN_PX;
    return Math.max(1, Math.ceil(MIN_LABEL_PX / weekPx));
  }, [totalDays]);

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
      <div className="min-w-[760px]">
        {/* Week header */}
        <div className="text-muted-foreground relative mb-2 ml-64 h-5 border-b text-[11px]">
          {weeks.map((w, i) =>
            i % labelStep === 0 ? (
              <span
                key={w.toISOString()}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${pct(w)}%` }}
              >
                {format(w, "M/d", { locale: ko })}
              </span>
            ) : null,
          )}
        </div>

        <div className="relative">
          {/* Today marker */}
          {todayLeft >= 0 && todayLeft <= 100 && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 ml-64 w-px bg-red-500"
              style={{ left: `${todayLeft}%` }}
            />
          )}

          <div className="flex flex-col gap-4">
            {groups.map((g, gi) => (
              <div key={gi} className="flex flex-col gap-1">
                <p className="text-muted-foreground ml-1 text-xs font-medium">
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
                        <div className="flex w-64 shrink-0 items-center gap-1 pr-3">
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
                        <div className="relative h-7 flex-1">
                          {r ? (
                            <Link
                              href={`/epics/${epic.id}`}
                              className={cn(
                                "absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-[11px] font-medium text-white shadow-sm",
                                STATUS_META[epic.status].dot,
                              )}
                              style={{
                                left: `${Math.max(pct(r.start), 0)}%`,
                                width: `${Math.max(
                                  pct(addDays(r.end, 1)) - Math.max(pct(r.start), 0),
                                  2,
                                )}%`,
                              }}
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
                              <div className="flex w-64 shrink-0 items-center gap-1.5 py-0.5 pr-3 pl-7">
                                <Link
                                  href={`/tasks/${t.id}`}
                                  className="text-muted-foreground min-w-0 flex-1 truncate text-xs hover:underline"
                                  title={t.title}
                                >
                                  {t.title}
                                </Link>
                                <UserBadge user={t.assignee} hideName size="xs" />
                              </div>
                              <div className="relative h-6 flex-1">
                                {tr && (
                                  <Link
                                    href={`/tasks/${t.id}`}
                                    className={cn(
                                      "absolute top-1/2 h-3.5 -translate-y-1/2 rounded-sm opacity-80",
                                      STATUS_META[t.status].dot,
                                    )}
                                    style={{
                                      left: `${Math.max(pct(tr.start), 0)}%`,
                                      width: `${Math.max(
                                        pct(addDays(tr.end, 1)) -
                                          Math.max(pct(tr.start), 0),
                                        1.5,
                                      )}%`,
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
