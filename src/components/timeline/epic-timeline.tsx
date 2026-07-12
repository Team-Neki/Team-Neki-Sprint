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

// Layout constants. NAME_W is the default name-gutter width (16rem = 256px);
// it is now resizable at runtime via the drag divider, so it seeds state.
const NAME_W = 256;
const NAME_W_MIN = 140;
const NAME_W_MAX = 560;
// 이름 열 구분선 ↔ 그래프(막대) 시작 사이 여백(px). 눈금 원점을 이만큼 밀어
// 축(월/일)·마커·막대가 모두 같은 원점(nameW + RULER_PAD)에 정렬되게 한다.
const RULER_PAD = 12;
// 셀 내부 좌측 텍스트 여백(px) — 월 라벨과 일 숫자가 같은 시작 오프셋을 쓰게 한다.
const CELL_PAD = 2;
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

  // 이름 열(거터) 폭 — 드래그 리사이즈 가능. 구분선은 별도 오버레이가 아니라
  // sticky 거터의 border-r 로 그린다(거터가 CSS sticky 라 스크롤에 안 흔들림).
  const [nameW, setNameW] = useState(NAME_W);

  function onResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = nameW;
    const onMove = (ev: PointerEvent) => {
      const next = startW + (ev.clientX - startX);
      setNameW(Math.min(NAME_W_MAX, Math.max(NAME_W_MIN, next)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

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
      <div className="relative" style={{ width: nameW + RULER_PAD + rulerWidth }}>
        {/* 날짜 축(2줄): 상단=월("N월"), 하단=모든 일자 숫자. 이름 거터 위는 sticky
            마스크로 가려 가로 스크롤 시 라벨이 거터 아래로 비치지 않게 한다. */}
        <div
          className="text-muted-foreground relative h-11 border-b text-[11px]"
          style={{ width: nameW + RULER_PAD + rulerWidth }}
        >
          {/* sticky gutter mask over the frozen name column. border-r = 이름 열 ↔
              타임라인 구분선(sticky 라 스크롤에 안 흔들림). 우측 끝에 드래그 리사이즈 핸들. */}
          <div
            className="bg-card border-border sticky left-0 z-40 h-full border-r border-b"
            style={{ width: nameW }}
          >
            <div
              onPointerDown={onResizeStart}
              role="separator"
              aria-orientation="vertical"
              aria-label="이름 열 너비 조절"
              className="hover:bg-link/30 absolute inset-y-0 -right-1 z-40 w-2 cursor-col-resize"
            />
          </div>
          {/* 월 라벨(상단)·일자 숫자(하단) 모두 셀 좌측(시작) 정렬 + 동일한 CELL_PAD
              오프셋 → 각 달 첫날의 "N월"과 그 아래 일 숫자의 시작 글자가 세로로 맞는다. */}
          {months.map(({ index, label }) => (
            <span
              key={`m${index}`}
              className="text-foreground absolute top-1 whitespace-nowrap font-semibold"
              style={{ left: nameW + RULER_PAD + index * dayWidth + CELL_PAD }}
            >
              {label}
            </span>
          ))}
          {/* 일자 숫자(하단) — 모든 날짜. 월 라벨과 세로 간격(gap)을 두려고 bottom 을 내린다. */}
          {dayList.map((d, i) => (
            <span
              key={`d${i}`}
              className="absolute bottom-1.5 text-[10px] tabular-nums"
              style={{ left: nameW + RULER_PAD + i * dayWidth + CELL_PAD }}
            >
              {format(d, "d")}
            </span>
          ))}
        </div>

        <div className="relative">
          {/* 월 경계 세로 구분선 — 각 달 첫 표시일 위치(index 0 은 거터 구분선과 겹쳐 생략).
              막대 뒤(z-0)에 깔려 그리드 역할만 한다. */}
          {months.map(({ index }) =>
            index === 0 ? null : (
              <div
                key={`mline${index}`}
                className="bg-border pointer-events-none absolute top-0 bottom-0 z-0 w-px"
                style={{ left: nameW + RULER_PAD + index * dayWidth }}
              />
            ),
          )}

          {/* Today marker */}
          {todayIndex >= 0 && todayIndex < totalDays && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-red-500"
              style={{ left: nameW + RULER_PAD + todayIndex * dayWidth }}
            />
          )}

          <div className="flex flex-col">
            {groups.map((g, gi) => (
              <div key={gi}>
                {/* 그룹 간 간격을 이름 열에서도 이어지게 하는 sticky 스페이서 —
                    border-r 로 구분선을 잇고 bg-card 로 월 구분선 침범을 막는다. */}
                {gi > 0 && (
                  <div
                    className="bg-card border-border sticky left-0 z-30 h-8 border-r"
                    style={{ width: nameW }}
                  />
                )}
                {/* gap 을 두지 않는다: sticky 거터가 세로로 맞닿아야 border-r(구분선)이
                    끊기지 않고 이어진다. 행 간 여백은 각 행의 막대 컨테이너 높이로 확보. */}
                <div className="flex flex-col">
                <div
                  className="bg-card border-border text-foreground sticky left-0 z-30 flex shrink-0 items-center gap-1.5 border-r pr-3 pl-3 text-xs font-medium"
                  style={{ width: nameW }}
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
                        <div
                          className="bg-card border-border sticky left-0 z-30 flex shrink-0 items-center gap-1 self-stretch border-r pr-3 pl-4"
                          style={{ width: nameW }}
                        >
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
                          style={{ width: rulerWidth, marginLeft: RULER_PAD }}
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
                                style={{ left: nameW + RULER_PAD + 4 }}
                              >
                                {epic.tasks.length > 0
                                  ? `${epic.tasks.length} 태스크`
                                  : format(r.end, "M/d", { locale: ko })}
                              </span>
                            </Link>
                          ) : (
                            // 일정 미설정 라벨은 sticky 가 아니라 스크롤 콘텐츠(ruler)
                            // 안에 두어 막대(그래프)와 함께 좌우로 움직인다. left 는
                            // 일자 라벨과 같은 CELL_PAD 오프셋으로 구분선 여백을 맞춘다.
                            <span
                              className="text-muted-foreground/60 pointer-events-none absolute top-1/2 -translate-y-1/2 text-[11px] whitespace-nowrap"
                              style={{ left: CELL_PAD }}
                            >
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
                              <div
                                className="bg-card border-border sticky left-0 z-30 flex shrink-0 items-center gap-1.5 self-stretch border-r py-0.5 pr-3 pl-9"
                                style={{ width: nameW }}
                              >
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
                                style={{ width: rulerWidth, marginLeft: RULER_PAD }}
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
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
