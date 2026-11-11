import { describe, expect, it } from "vitest";
import {
  getCalendarWeekItems,
  getGanttPage,
  getScheduleWindow,
  getVisibleScheduleSpan,
  scheduleToday,
} from "./dashboard-schedule";

const today = "2026-11-09";

describe("dashboard schedule", () => {
  it("uses the Korean day boundary and opens the current calendar month by default", () => {
    expect(scheduleToday(new Date("2026-11-08T15:10:00.000Z"))).toBe(today);
    expect(getScheduleWindow({}, today)).toMatchObject({
      view: "calendar",
      first: "2026-11-01",
      last: "2026-11-30",
    });
    expect(getScheduleWindow({ view: ["gantt", "calendar"] }, today).view).toBe("calendar");
  });

  it("shows two Monday-first weeks in Gantt and moves by fourteen days", () => {
    const gantt = getScheduleWindow({ view: "gantt", date: "2026-11-10" }, today);
    expect(gantt).toMatchObject({
      view: "gantt",
      first: today,
      last: "2026-11-22",
      previous: "2026-10-27",
      next: "2026-11-24",
    });
    expect(gantt.days).toHaveLength(14);
    expect(getScheduleWindow({ view: "gantt", date: gantt.next }, today).first).toBe("2026-11-23");
  });

  it("fills the calendar with complete weeks across month boundaries", () => {
    const month = getScheduleWindow({ view: "calendar", date: "2026-12-09" }, today);
    expect(month.days[0]).toBe("2026-11-29");
    expect(month.days.at(-1)).toBe("2027-01-02");
    expect(month.days.length % 7).toBe(0);
    expect(month.next).toBe("2027-01-01");
  });

  it("falls back to today for malformed or repeated dates", () => {
    expect(getScheduleWindow({ date: "2026-02-30" }, today).anchor).toBe(today);
    expect(getScheduleWindow({ date: [today, "2026-11-11"] }, today).anchor).toBe(today);
  });

  it("caps each gantt page and keeps out-of-range requests on a valid page", () => {
    expect(getGanttPage(undefined, 45)).toEqual({ page: 1, pageCount: 3, start: 0, end: 20 });
    expect(getGanttPage("2", 45)).toEqual({ page: 2, pageCount: 3, start: 20, end: 40 });
    expect(getGanttPage("99", 45)).toEqual({ page: 3, pageCount: 3, start: 40, end: 45 });
    expect(getGanttPage(["2", "3"], 45).page).toBe(1);
    expect(getGanttPage("-1", 45).page).toBe(1);
    expect(getGanttPage("2", 0)).toEqual({ page: 1, pageCount: 1, start: 0, end: 0 });
  });

  it("clips spans to the Gantt window and plots deadlines in either week", () => {
    const { days } = getScheduleWindow({ view: "gantt" }, today);
    const item = { id: "task-1", title: "태스크", kind: "task", status: "TODO" } as const;
    expect(getVisibleScheduleSpan({ ...item, start: "2026-11-01", end: "2026-11-11" }, days))
      .toMatchObject({ start: 0, count: 3, milestone: false });
    expect(getVisibleScheduleSpan({ ...item, start: null, end: "2026-11-11" }, days))
      .toMatchObject({ start: 2, count: 1, milestone: true });
    expect(getVisibleScheduleSpan({ ...item, start: null, end: "2026-11-18" }, days))
      .toMatchObject({ start: 9, count: 1, milestone: true });
    expect(getVisibleScheduleSpan({ ...item, start: null, end: null }, days)).toBeNull();
  });

  it("lays out a calendar range once and separates overlapping cards into lanes", () => {
    const week = getScheduleWindow({}, today).days.slice(0, 7);
    const base = { title: "태스크", kind: "task", status: "TODO" } as const;
    const rows = getCalendarWeekItems([
      { ...base, id: "long", start: "2026-11-02", end: "2026-11-06" },
      { ...base, id: "early", start: "2026-11-03", end: "2026-11-04" },
      { ...base, id: "late", start: "2026-11-05", end: "2026-11-06" },
      { ...base, id: "deadline", start: null, end: "2026-11-06" },
    ], week);
    expect(rows.map(({ item, span, lane }) => [item.id, span.start, span.count, lane])).toEqual([
      ["long", 1, 5, 0],
      ["early", 2, 2, 1],
      ["late", 4, 2, 1],
      ["deadline", 5, 1, 2],
    ]);
  });

  it("continues the same calendar range across week boundaries", () => {
    const days = getScheduleWindow({}, today).days;
    const item = { id: "range", title: "태스크", kind: "task", status: "TODO", start: "2026-11-06", end: "2026-11-10" } as const;
    expect(getCalendarWeekItems([item], days.slice(0, 7))[0].span).toMatchObject({ start: 5, count: 2 });
    expect(getCalendarWeekItems([item], days.slice(7, 14))[0].span).toMatchObject({ start: 0, count: 3 });
    expect(getCalendarWeekItems([item], days.slice(14, 21))).toEqual([]);
  });
});
