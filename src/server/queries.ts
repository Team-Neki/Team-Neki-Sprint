import { prisma } from "@/lib/prisma";
import type { Status } from "@prisma/client";

const miniUser = {
  select: { id: true, name: true, email: true, image: true },
} as const;

export function getMembers() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, image: true },
    orderBy: { name: "asc" },
  });
}

export function getInitiatives() {
  return prisma.initiative.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      owner: miniUser,
      _count: { select: { epics: true } },
    },
  });
}

export function getInitiative(id: string) {
  return prisma.initiative.findUnique({
    where: { id },
    include: {
      owner: miniUser,
      epics: {
        orderBy: { createdAt: "desc" },
        include: {
          owner: miniUser,
          _count: { select: { tasks: true } },
        },
      },
    },
  });
}

export function getEpics() {
  return prisma.epic.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      owner: miniUser,
      initiative: { select: { id: true, title: true, key: true } },
      _count: { select: { tasks: true } },
    },
  });
}

export function getEpic(id: string) {
  return prisma.epic.findUnique({
    where: { id },
    include: {
      owner: miniUser,
      initiative: { select: { id: true, title: true, key: true } },
      tasks: {
        orderBy: { createdAt: "desc" },
        include: { assignee: miniUser },
      },
    },
  });
}

export function getBoardTasks() {
  return prisma.task.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      assignee: miniUser,
      epic: { select: { id: true, title: true, key: true } },
    },
  });
}

export type TaskFilter = {
  status?: Status;
  assigneeId?: string;
  epicId?: string;
  q?: string;
};

export function getTasks(filter: TaskFilter = {}) {
  return prisma.task.findMany({
    where: {
      status: filter.status,
      assigneeId: filter.assigneeId,
      epicId: filter.epicId,
      title: filter.q
        ? { contains: filter.q, mode: "insensitive" }
        : undefined,
    },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
    include: {
      assignee: miniUser,
      epic: { select: { id: true, title: true, key: true } },
    },
  });
}

export function getTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      assignee: miniUser,
      reporter: miniUser,
      epic: {
        select: {
          id: true,
          title: true,
          key: true,
          initiative: { select: { id: true, title: true } },
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: miniUser },
      },
    },
  });
}

export function getTimelineTasks() {
  return prisma.task.findMany({
    where: { OR: [{ startDate: { not: null } }, { dueDate: { not: null } }] },
    orderBy: { dueDate: "asc" },
    include: { assignee: miniUser, epic: { select: { title: true, key: true } } },
  });
}

/**
 * Epic-centric timeline data (Jira roadmap style): every epic with its owner,
 * parent initiative, and child tasks. The client rolls epic date ranges up from
 * tasks when the epic itself has no dates.
 */
export function getTimelineEpics() {
  return prisma.epic.findMany({
    orderBy: [{ initiativeId: "asc" }, { createdAt: "asc" }],
    include: {
      owner: miniUser,
      initiative: { select: { id: true, title: true, key: true } },
      tasks: {
        orderBy: [{ startDate: "asc" }, { dueDate: "asc" }],
        select: {
          id: true,
          key: true,
          title: true,
          status: true,
          startDate: true,
          dueDate: true,
          assignee: miniUser,
        },
      },
    },
  });
}

/** Full page tree (small dataset for a 20-person team). */
export function getWikiTree() {
  return prisma.wikiPage.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      parentId: true,
      position: true,
      updatedAt: true,
    },
  });
}

export function getWikiPage(id: string) {
  return prisma.wikiPage.findUnique({
    where: { id },
    include: {
      author: miniUser,
      editor: miniUser,
      revisions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, title: true, createdAt: true },
      },
    },
  });
}

export async function getDashboardData() {
  const [statusCounts, totalTasks, myTasks, recentActivity, initiatives] =
    await Promise.all([
      prisma.task.groupBy({ by: ["status"], _count: true }),
      prisma.task.count(),
      prisma.task.findMany({
        where: { status: { not: "DONE" }, dueDate: { not: null } },
        orderBy: { dueDate: "asc" },
        take: 6,
        include: { assignee: miniUser, epic: { select: { key: true } } },
      }),
      prisma.activity.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { user: miniUser },
      }),
      prisma.initiative.findMany({
        where: { status: { not: "DONE" } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { _count: { select: { epics: true } } },
      }),
    ]);

  return { statusCounts, totalTasks, myTasks, recentActivity, initiatives };
}
