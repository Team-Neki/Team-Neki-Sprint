"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  max as maxDate,
  min as minDate,
  startOfDay,
} from "date-fns";
import { ko } from "date-fns/locale";
import type { Status, Priority } from "@prisma/client";
import { formatIssueKey } from "@/lib/constants";
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
  const { start, totalDays, dayWidth, rulerWidth, dayList, months } = useMemo(() => {
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

    // 상단 월 라벨: 각 달의 첫 표시일 인덱스에 "N월"을 놓는다(월 경계마다 1개).
    // 일(day) 숫자는 모든 셀에 표시하므로 여기선 월만 계산한다.
    const ms: { index: number; label: string }[] = [];
    let lastKey = "";
    list.forEach((d, i) => {
      const key = format(d, "yyyy-MM");
      if (key !== lastKey) {
        ms.push({ index: i, label: `${format(d, "M")}월` });
        lastKey = key;
      }
    });

    return {
      start: s,
      totalDays: days,
      dayWidth: width,
      rulerWidth: days * width,
      dayList: list,
      months: ms,
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

  // Group epics under their owner (담당자), preserving order.
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { title: string; owner: MiniUser | null; epics: TimelineEpic[] }
    >();
    for (const e of epics) {
      const key = e.owner?.id ?? "__none__";
      const title = e.owner?.name ?? e.owner?.email ?? "담당자 없음";
      if (!map.has(key)) map.set(key, { title, owner: e.owner, epics: [] });
      map.get(key)!.epics.push(e);
    }
    return [...map.values()];
  }, [epics]);

  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width: NAME_W + rulerWidth }}>
        {/* 날짜 축(2줄): 상단=월("N월"), 하단=모든 일자 숫자. 이름 거터 위는 sticky
            마스크로 가려 가로 스크롤 시 라벨이 거터 아래로 비치지 않게 한다. */}
        <div
          className="text-muted-foreground relative mb-2 h-9 border-b text-[11px]"
          style={{ width: NAME_W + rulerWidth }}
        >
          {/* sticky gutter mask over the frozen name column */}
          <div
            className="bg-card sticky left-0 z-30 h-full border-b"
            style={{ width: NAME_W }}
          />
          {/* 월 라벨(상단) — 각 달의 첫 표시일 위치 */}
          {months.map(({ index, label }) => (
            <span
              key={`m${index}`}
              className="text-foreground absolute top-1 whitespace-nowrap font-semibold"
              style={{ left: NAME_W + index * dayWidth + 2 }}
            >
              {label}
            </span>
          ))}
          {/* 일자 숫자(하단) — 모든 날짜, 셀 폭 중앙정렬이라 겹치지 않는다 */}
          {dayList.map((d, i) => (
            <span
              key={`d${i}`}
              className="absolute bottom-1 text-center text-[10px] tabular-nums"
              style={{ left: NAME_W + i * dayWidth, width: dayWidth }}
            >
              {format(d, "d")}
            </span>
          ))}
        </div>

        <div className="relative">
          {/* 회색 세로줄(주별 그리드·주말 음영) 제거 — 오늘 마커(빨강)만 남긴다. */}

          {/* Today marker */}
          {todayIndex >= 0 && todayIndex < totalDays && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500"
              style={{ left: NAME_W + todayIndex * dayWidth }}
            />
          )}

          <div className="flex flex-col gap-8">
            {groups.map((g, gi) => (
              <div key={gi} className="flex flex-col gap-1">
                <div
                  className="bg-card text-foreground sticky left-0 z-20 flex w-64 shrink-0 items-center gap-1.5 pl-1 text-xs font-medium"
                  title={g.title}
                >
                  <UserBadge user={g.owner} hideName size="xs" />
                  <span className="truncate">{g.title}</span>
                </div>
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
                                // overflow-clip(=clip, scroll container 아님)로 막대 밖은 잘라내되
                                // 내부 라벨의 sticky 는 외부 가로 스크롤 컨테이너 기준으로 유지한다.
                                // 에픽 = 옅은 회색(상태색 대신 계층 구분용).
                                "absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-clip rounded-md bg-neutral-300 px-2 text-[11px] font-medium text-neutral-800 shadow-sm",
                              )}
                              style={{ left: leftPx(r.start), width: spanPx(r) }}
                            >
                              {/* 라벨을 이름 거터 우측(left:NAME_W)에 sticky 고정 → 가로 스크롤 시
                                  보이는 좌측 끝에 머물다가, 막대가 지나가면 막대와 함께 밀려난다. */}
                              <span
                                // pl-1 + left 오프셋: sticky 로 끌려와 이름 거터에
                                // 붙을 때 글자 좌측이 잘리지 않도록 여백을 준다.
                                className="sticky min-w-0 truncate pl-1"
                                style={{ left: NAME_W + 4 }}
                              >
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
                                    // 태스크 = 에픽보다 조금 더 짙은 회색(개별 태스크는 색 구분 안 함).
                                    className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-sm bg-neutral-500"
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
