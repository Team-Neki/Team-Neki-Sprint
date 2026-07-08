import { prisma } from "@/lib/prisma";
import type { Status } from "@prisma/client";
import { formatIssueKey } from "@/lib/constants";

const miniUser = {
  select: {
    id: true,
    name: true,
    email: true,
    image: true,
    // 아바타 hover 툴팁(이름 - 팀명)용.
    team: { select: { key: true, name: true } },
  },
} as const;

// Epic·Task 표시 key 계산에 필요한 최소 팀 정보.
const miniTeam = {
  select: { id: true, key: true, name: true, color: true },
} as const;

// ---------- MD(맨데이) 롤업 (B7, 읽기전용 계산) ----------

/** MD 롤업 값. estimated=예상 합, actual=실제 합. */
export type MdRollup = { estimated: number; actual: number };
const ZERO_MD: MdRollup = { estimated: 0, actual: 0 };

/** 태스크 배열의 estimated/actual MD 합. */
function sumMd(
  tasks: { estimatedMd: number | null; actualMd: number | null }[],
): MdRollup {
  return tasks.reduce<MdRollup>(
    (acc, t) => ({
      estimated: acc.estimated + (t.estimatedMd ?? 0),
      actual: acc.actual + (t.actualMd ?? 0),
    }),
    { estimated: 0, actual: 0 },
  );
}

/** 에픽 id별 하위 태스크 MD 합(groupBy 집계). */
async function mdByEpic(epicIds: string[]): Promise<Map<string, MdRollup>> {
  const map = new Map<string, MdRollup>();
  if (epicIds.length === 0) return map;
  const rows = await prisma.task.groupBy({
    by: ["epicId"],
    where: { epicId: { in: epicIds } },
    _sum: { estimatedMd: true, actualMd: true },
  });
  for (const r of rows) {
    if (!r.epicId) continue;
    map.set(r.epicId, {
      estimated: r._sum.estimatedMd ?? 0,
      actual: r._sum.actualMd ?? 0,
    });
  }
  return map;
}

/** 프로젝트 id별 하위(에픽→태스크) MD 합. Task 에 projectId 가 없어 에픽 경유로 집계. */
async function mdByProject(projectIds: string[]): Promise<Map<string, MdRollup>> {
  const map = new Map<string, MdRollup>();
  if (projectIds.length === 0) return map;
  const epics = await prisma.epic.findMany({
    where: { projectId: { in: projectIds } },
    select: {
      projectId: true,
      tasks: { select: { estimatedMd: true, actualMd: true } },
    },
  });
  for (const e of epics) {
    if (!e.projectId) continue;
    const cur = map.get(e.projectId) ?? { estimated: 0, actual: 0 };
    const s = sumMd(e.tasks);
    map.set(e.projectId, {
      estimated: cur.estimated + s.estimated,
      actual: cur.actual + s.actual,
    });
  }
  return map;
}

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

export async function getSprint(id: string) {
  const sprint = await prisma.sprint.findUnique({
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
  if (!sprint) return null;
  // 하위 프로젝트별 MD 롤업(에픽→태스크 합) 부착 — ProjectsTable 의 MD 컬럼용.
  const md = await mdByProject(sprint.projects.map((p) => p.id));
  const projects = sprint.projects.map((p) => ({
    ...p,
    md: md.get(p.id) ?? ZERO_MD,
  }));
  return { ...sprint, projects };
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

export async function getProjects(filter: ProjectFilter = {}) {
  const projects = await prisma.project.findMany({
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
  // MD 롤업(하위 에픽→태스크 합) 부착.
  const md = await mdByProject(projects.map((p) => p.id));
  return projects.map((p) => ({ ...p, md: md.get(p.id) ?? ZERO_MD }));
}

export async function getProject(id: string) {
  const project = await prisma.project.findUnique({
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
  if (!project) return null;
  // 하위 에픽별 MD + 프로젝트 총합(읽기전용 롤업).
  const perEpic = await mdByEpic(project.epics.map((e) => e.id));
  const epics = project.epics.map((e) => ({
    ...e,
    md: perEpic.get(e.id) ?? ZERO_MD,
  }));
  const md = epics.reduce<MdRollup>(
    (a, e) => ({
      estimated: a.estimated + e.md.estimated,
      actual: a.actual + e.md.actual,
    }),
    { estimated: 0, actual: 0 },
  );
  return { ...project, epics, md };
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

export async function getEpics(filter: EpicFilter = {}) {
  const epics = await prisma.epic.findMany({
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
  const md = await mdByEpic(epics.map((e) => e.id));
  return epics.map((e) => ({ ...e, md: md.get(e.id) ?? ZERO_MD }));
}

export async function getEpic(id: string) {
  const epic = await prisma.epic.findUnique({
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
  if (!epic) return null;
  // 하위 태스크 MD 합(이미 로드된 tasks 로 계산).
  return { ...epic, md: sumMd(epic.tasks) };
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
    // 칸반 컬럼 내 순서(B7-board). 재정렬로 부여한 boardOrder 우선, 미정렬(null)은 하단.
    orderBy: [
      { boardOrder: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
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

// ---------- Activity (업무 히스토리, B8) ----------

/**
 * 특정 엔티티의 변경 이력(Activity) 최신순 + 액터. 상세 페이지 업무 히스토리 패널용.
 * meta 에 { field, from, to } 가 담긴 field_changed 이벤트 + 기존 created/commented 등을 함께 반환.
 */
export function getEntityActivity(
  entityType: "sprint" | "project" | "team" | "epic" | "task" | "wiki",
  entityId: string,
  take = 50,
) {
  return prisma.activity.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
    include: { user: miniUser },
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

/** 페이지의 버전 기록 목록(경량: 내용 제외, 작성자·시각만). ⋯ 메뉴 버전 기록 리스트용. */
export function getWikiRevisions(pageId: string) {
  return prisma.wikiRevision.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      editor: miniUser,
    },
  });
}

/** 단일 리비전(내용 포함). 버전 미리보기용. */
export function getWikiRevision(id: string) {
  return prisma.wikiRevision.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      editor: miniUser,
    },
  });
}

/** 현재 유저가 별표한 페이지 목록(최신 별표 순). 즐겨찾기 패널용. */
export function getWikiFavorites(userId: string) {
  return prisma.wikiFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      page: { select: { id: true, title: true } },
    },
  });
}

/** 특정 페이지를 현재 유저가 별표했는지 여부. ⋯ 메뉴 별표 토글 라벨용. */
export async function isWikiPageFavorited(userId: string, pageId: string) {
  const row = await prisma.wikiFavorite.findUnique({
    where: { userId_pageId: { userId, pageId } },
    select: { pageId: true },
  });
  return !!row;
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
 * 위키 인라인 댓글 스레드 조회(B10). 페이지의 모든 스레드 + 각 스레드의 댓글을
 * 시간순으로. 미해결(resolved=false)을 먼저, 그 안에서 최신 스레드 우선.
 */
export function getWikiComments(pageId: string) {
  return prisma.wikiCommentThread.findMany({
    where: { pageId },
    orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: miniUser },
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

// ---------- 사람/프로필/알림 (B5) ----------

/** '@' 멘션 드롭다운용 멤버 검색(이름/이메일). */
export function searchMembers(query: string, limit = 8) {
  const q = query.trim();
  return prisma.user.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    take: limit,
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      team: { select: { key: true, name: true } },
    },
  });
}

/** 프로필 페이지: 기본 정보 + 담당 태스크(진행 중) + 오너 에픽. */
export function getUserProfile(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phone: true,
      role: true,
      team: { select: { id: true, key: true, name: true, color: true } },
      assignedTasks: {
        where: { status: { not: "DONE" } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 20,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          team: { select: { key: true } },
        },
      },
      ownedEpics: {
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 20,
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          team: { select: { key: true } },
        },
      },
    },
  });
}

/** 수신자 기준 최근 알림. actor 이름/아바타 포함. */
export function getNotifications(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: miniUser },
  });
}

export function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
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

  // 최근 활동 enrich: 티켓 key(TEAM-n) + 엔티티 제목 + 값 해석용 lookup.
  // entityId 는 폴리모픽이라 task/epic 은 모아서 조회, 나머지 이름은 lookup 으로 해석.
  const taskIds = recentActivityRaw
    .filter((a) => a.entityType === "task")
    .map((a) => a.entityId);
  const epicIds = recentActivityRaw
    .filter((a) => a.entityType === "epic")
    .map((a) => a.entityId);
  const [
    actTasks,
    actEpics,
    lookupMembers,
    lookupEpics,
    lookupProjects,
    lookupSprints,
  ] = await Promise.all([
    taskIds.length
      ? prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: {
            id: true,
            number: true,
            title: true,
            team: { select: { key: true } },
          },
        })
      : Promise.resolve([]),
    epicIds.length
      ? prisma.epic.findMany({
          where: { id: { in: epicIds } },
          select: {
            id: true,
            number: true,
            title: true,
            team: { select: { key: true } },
          },
        })
      : Promise.resolve([]),
    prisma.user.findMany({ select: { id: true, name: true, email: true } }),
    prisma.epic.findMany({ select: { id: true, title: true } }),
    prisma.project.findMany({ select: { id: true, title: true } }),
    prisma.sprint.findMany({ select: { id: true, name: true } }),
  ]);
  const keyMap = new Map<string, string>();
  const titleMap = new Map<string, string>();
  for (const t of actTasks) {
    keyMap.set(t.id, formatIssueKey(t.team.key, t.number));
    titleMap.set(t.id, t.title);
  }
  for (const e of actEpics) {
    keyMap.set(e.id, formatIssueKey(e.team.key, e.number));
    titleMap.set(e.id, e.title);
  }
  for (const p of lookupProjects) titleMap.set(p.id, p.title);
  for (const s of lookupSprints) titleMap.set(s.id, s.name);

  const recentActivity = recentActivityRaw.map((a) => ({
    ...a,
    entityKey: keyMap.get(a.entityId) ?? null,
    entityTitle: titleMap.get(a.entityId) ?? null,
  }));

  return {
    statusCounts,
    totalTasks,
    myTasks,
    recentActivity,
    projects,
    activityLookups: {
      members: lookupMembers,
      epics: lookupEpics,
      projects: lookupProjects,
      sprints: lookupSprints,
    },
  };
}
