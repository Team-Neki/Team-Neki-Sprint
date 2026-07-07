import { prisma } from "@/lib/prisma";
import type { Status } from "@prisma/client";
import { formatIssueKey } from "@/lib/constants";

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
      // 연결된 위키(#3).
      wikiLinks: {
        include: { page: { select: { id: true, title: true } } },
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
      folderId: true,
      position: true,
      updatedAt: true,
    },
  });
}

/** 문서 폴더(사이드바 그룹핑). 페이지와 별개 타입. */
export function getWikiFolders() {
  return prisma.wikiFolder.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, parentId: true, position: true },
  });
}

export function getWikiPage(id: string) {
  return prisma.wikiPage.findUnique({
    where: { id },
    include: {
      author: miniUser,
      editor: miniUser,
      // 연결된 티켓(#3). key 표시에 team만 있으면 된다.
      taskLinks: {
        include: {
          task: {
            select: {
              id: true,
              number: true,
              title: true,
              status: true,
              team: { select: { key: true } },
            },
          },
        },
      },
      revisions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, title: true, createdAt: true },
      },
    },
  });
}

/**
 * 티켓 검색(#3/#4). key(TEAM-n)나 제목으로 조회. formatIssueKey 기준의 key는
 * team.key + '-' + number 이므로, 'BACKEND-2' / 'BACKEND' / '2' / 제목 조각을 받는다.
 */
export async function searchTasks(query: string, limit = 8) {
  const q = query.trim();
  const where: import("@prisma/client").Prisma.TaskWhereInput = {};

  if (q) {
    const or: import("@prisma/client").Prisma.TaskWhereInput[] = [
      { title: { contains: q, mode: "insensitive" } },
    ];
    // "TEAM-123" 또는 "TEAM" + 숫자 형태를 key 매칭으로 해석.
    const dashMatch = q.match(/^([A-Za-z0-9]+)-(\d+)$/);
    if (dashMatch) {
      or.push({
        team: { key: { equals: dashMatch[1], mode: "insensitive" } },
        number: Number(dashMatch[2]),
      });
    } else if (/^\d+$/.test(q)) {
      or.push({ number: Number(q) });
    } else if (/^[A-Za-z]+$/.test(q)) {
      or.push({ team: { key: { contains: q, mode: "insensitive" } } });
    }
    where.OR = or;
  }

  return prisma.task.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      team: { select: { key: true } },
    },
  });
}

/** 위키 페이지 검색(#3, 티켓 상세에서 연결할 페이지 찾기). */
export function searchWikiPages(query: string, limit = 8) {
  const q = query.trim();
  return prisma.wikiPage.findMany({
    where: q ? { title: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, title: true },
  });
}

export async function getDashboardData() {
  const [statusCounts, totalTasks, myTasks, recentActivityRaw, projects] =
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

  // 최근 활동에 티켓 key(TEAM-n) 를 붙인다. entityId 는 폴리모픽이라 task/epic 만 모아 조회.
  const taskIds = recentActivityRaw
    .filter((a) => a.entityType === "task")
    .map((a) => a.entityId);
  const epicIds = recentActivityRaw
    .filter((a) => a.entityType === "epic")
    .map((a) => a.entityId);
  const [actTasks, actEpics] = await Promise.all([
    taskIds.length
      ? prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: { id: true, number: true, team: { select: { key: true } } },
        })
      : Promise.resolve([]),
    epicIds.length
      ? prisma.epic.findMany({
          where: { id: { in: epicIds } },
          select: { id: true, number: true, team: { select: { key: true } } },
        })
      : Promise.resolve([]),
  ]);
  const keyMap = new Map<string, string>();
  for (const t of actTasks) keyMap.set(t.id, formatIssueKey(t.team.key, t.number));
  for (const e of actEpics) keyMap.set(e.id, formatIssueKey(e.team.key, e.number));

  const recentActivity = recentActivityRaw.map((a) => ({
    ...a,
    entityKey: keyMap.get(a.entityId) ?? null,
  }));

  return { statusCounts, totalTasks, myTasks, recentActivity, projects };
}
