import { prisma } from "@/lib/prisma";
import { scheduleDate, type ScheduleItem } from "@/lib/dashboard-schedule";

export async function getDashboardSchedule(first: string, last: string) {
  const gte = new Date(`${first}T00:00:00.000Z`);
  const lte = new Date(`${last}T23:59:59.999Z`);
  // Include milestones and spans, including spans covering the entire window.
  const dueDateWindow = [
    { startDate: { gte, lte } },
    { dueDate: { gte, lte } },
    { startDate: { lt: gte }, dueDate: { gt: lte } },
  ];
  const select = { id: true, title: true, status: true, startDate: true, dueDate: true } as const;
  const [sprints, projects, tasks] = await Promise.all([
    prisma.sprint.findMany({
      where: {
        OR: [
          { startDate: { gte, lte } },
          { endDate: { gte, lte } },
          { startDate: { lt: gte }, endDate: { gt: lte } },
        ],
      },
      select: { id: true, name: true, status: true, startDate: true, endDate: true },
    }),
    prisma.project.findMany({ where: { OR: dueDateWindow }, select }),
    prisma.task.findMany({
      where: { OR: dueDateWindow },
      select: { ...select, team: { select: { name: true } } },
    }),
  ]);

  const items: ScheduleItem[] = [
    ...sprints.map((s) => ({
      id: s.id,
      kind: "sprint" as const,
      title: s.name,
      status: s.status,
      start: s.startDate && scheduleDate(s.startDate),
      end: s.endDate && scheduleDate(s.endDate),
    })),
    ...projects.map((project) => ({
      id: project.id,
      kind: "project" as const,
      title: project.title,
      status: project.status,
      start: project.startDate && scheduleDate(project.startDate),
      end: project.dueDate && scheduleDate(project.dueDate),
    })),
    ...tasks.map((task) => ({
      id: task.id,
      kind: "task" as const,
      title: task.title,
      status: task.status,
      team: task.team.name,
      start: task.startDate && scheduleDate(task.startDate),
      end: task.dueDate && scheduleDate(task.dueDate),
    })),
  ];
  return items.sort((a, b) =>
    (a.start ?? a.end ?? "").localeCompare(b.start ?? b.end ?? "") ||
    a.title.localeCompare(b.title, "ko") || a.id.localeCompare(b.id),
  );
}
