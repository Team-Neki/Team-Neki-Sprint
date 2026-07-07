import { prisma } from "@/lib/prisma";
import type { Status } from "@prisma/client";

const miniUser = {
  select: { id: true, name: true, email: true, image: true },
} as const;

// Epic·Task 표시 key 계산에 필요한 최소 팀 정보.
const miniTeam = {
  select: { id: true, key: true, name: true, color: true },
} as const;

export function getMembers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      teamId: true,
      team: { select: { id: true, key: true, name: true, color: true } },
    },
    orderBy: { name: "asc" },
  });
}

export function getTeams() {
  return prisma.team.findMany({
    orderBy: { key: "asc" },
    include: {
      members: { ...miniUser, orderBy: { name: "asc" } },
      _count: { select: { epics: true, tasks: true, members: true } },
    },
  });
}

/** 폼 select 등에 쓰는 팀 옵션(경량). */
export function getTeamOptions() {
  return prisma.team.findMany({
    orderBy: { key: "asc" },
    select: { id: true, key: true, name: true, color: true },
  });
}

// ---------- Sprint ----------

export function getSprints() {
  return prisma.sprint.findMany({
    orderBy: [{ status: "asc" }, { startDate: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { projects: true } } },
  });
}

export function getSprint(id: string) {
  return prisma.sprint.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          owner: miniUser,
          _count: { select: { epics: true } },
        },
      },
    },
  });
}

export function getSprintOptions() {
  return prisma.sprint.findMany({
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true, status: true },
  });
}

// ---------- Project (구 Initiative) ----------

export type ProjectFilter = {
  ownerId?: string;
  sprintId?: string;
};

export function getProjects(filter: ProjectFilter = {}) {
  return prisma.project.findMany({
    where: {
      ownerId: filter.ownerId,
      sprintId: filter.sprintId,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      owner: miniUser,
      sprint: { select: { id: true, name: true, status: true } },
      _count: { select: { epics: true } },
    },
  });
}

export function getProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      owner: miniUser,
      sprint: { select: { id: true, name: true, status: true } },
      epics: {
        orderBy: { createdAt: "desc" },
        include: {
          owner: miniUser,
          team: miniTeam,
          _count: { select: { tasks: true } },
        },
      },
    },
  });
}

export function getProjectOptions() {
  return prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });
}

// ---------- Epic ----------

export type EpicFilter = {
  ownerId?: string;
  teamId?: string;
};

export function getEpics(filter: EpicFilter = {}) {
  return prisma.epic.findMany({
    where: {
      ownerId: filter.ownerId,
      teamId: filter.teamId,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      owner: miniUser,
      team: miniTeam,
      project: { select: { id: true, title: true } },
      _count: { select: { tasks: true } },
    },
  });
}

export function getEpic(id: string) {
  return prisma.epic.findUnique({
    where: { id },
    include: {
      owner: miniUser,
      team: miniTeam,
      project: { select: { id: true, title: true } },
      tasks: {
        orderBy: { createdAt: "desc" },
        include: { assignee: miniUser, team: miniTeam },
      },
    },
  });
}

/** 에픽 옵션(폼 select). 태스크 생성 시 에픽의 팀을 상속하기 위해 team도 함께. */
export function getEpicOptions() {
  return prisma.epic.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      number: true,
      team: { select: { id: true, key: true } },
    },
  });
}

// ---------- Task ----------

export type BoardFilter = {
  assigneeId?: string;
  teamId?: string;
};

export function getBoardTasks(filter: BoardFilter = {}) {
  return prisma.task.findMany({
    where: {
      assigneeId: filter.assigneeId,
      teamId: filter.teamId,
    },
    orderBy: { updatedAt: "desc" },
    include: {
      assignee: miniUser,
      team: miniTeam,
      epic: { select: { id: true, title: true } },
    },
  });
}

export type TaskFilter = {
  status?: Status;
  assigneeId?: string;
  epicId?: string;
  teamId?: string;
  q?: string;
};

export function getTasks(filter: TaskFilter = {}) {
  return prisma.task.findMany({
    where: {
      status: filter.status,
      assigneeId: filter.assigneeId,
      epicId: filter.epicId,
      teamId: filter.teamId,
      title: filter.q
        ? { contains: filter.q, mode: "insensitive" }
        : undefined,
    },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
    include: {
      assignee: miniUser,
      team: miniTeam,
      epic: { select: { id: true, title: true } },
    },
  });
}

export function getTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      assignee: miniUser,
      reporter: miniUser,
      team: miniTeam,
      epic: {
        select: {
          id: true,
          title: true,
          number: true,
          team: { select: { key: true } },
          project: { select: { id: true, title: true } },
        },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: miniUser },
      },
    },
  });
}

/**
 * Epic-centric timeline data (Jira roadmap style): every epic with its owner,
 * parent project, team, and child tasks. The client rolls epic date ranges up
 * from tasks when the epic itself has no dates and groups epics by project.
 */
export function getTimelineEpics() {
  return prisma.epic.findMany({
    orderBy: [{ projectId: "asc" }, { createdAt: "asc" }],
    include: {
      owner: miniUser,
      team: miniTeam,
      project: { select: { id: true, title: true } },
      tasks: {
        orderBy: [{ startDate: "asc" }, { dueDate: "asc" }],
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          startDate: true,
          dueDate: true,
          team: { select: { key: true } },
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
  const [statusCounts, totalTasks, myTasks, recentActivity, projects] =
    await Promise.all([
      prisma.task.groupBy({ by: ["status"], _count: true }),
      prisma.task.count(),
      prisma.task.findMany({
        where: { status: { not: "DONE" }, dueDate: { not: null } },
        orderBy: { dueDate: "asc" },
        take: 6,
        include: {
          assignee: miniUser,
          team: { select: { key: true } },
        },
      }),
      prisma.activity.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { user: miniUser },
      }),
      prisma.project.findMany({
        where: { status: { not: "DONE" } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { _count: { select: { epics: true } } },
      }),
    ]);

  return { statusCounts, totalTasks, myTasks, recentActivity, projects };
}
