import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma, Status } from "@prisma/client";
import { formatIssueKey } from "@/lib/constants";
import { CACHE_TAGS, CACHE_REVALIDATE } from "@/lib/cache";

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

// 이슈 행/상세에 배지로 붙는 라벨(C8). 이름순 정렬로 결정적 표시.
const labelInclude = {
  include: { label: { select: { id: true, name: true, color: true } } },
  orderBy: { label: { name: "asc" } },
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

export const getTeams = unstable_cache(
  () =>
    prisma.team.findMany({
      orderBy: { key: "asc" },
      include: {
        members: { ...miniUser, orderBy: { name: "asc" } },
        _count: { select: { epics: true, tasks: true, members: true } },
      },
    }),
  ["teams"],
  { tags: [CACHE_TAGS.teams], revalidate: CACHE_REVALIDATE.list },
);

/** 폼 select 등에 쓰는 팀 옵션(경량). */
export const getTeamOptions = unstable_cache(
  () =>
    prisma.team.findMany({
      orderBy: { key: "asc" },
      select: { id: true, key: true, name: true, color: true },
    }),
  ["team-options"],
  { tags: [CACHE_TAGS.teams], revalidate: CACHE_REVALIDATE.options },
);

// ---------- Sprint ----------

export const getSprints = unstable_cache(
  () =>
    prisma.sprint.findMany({
      orderBy: [{ status: "asc" }, { startDate: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { projects: true } } },
    }),
  ["sprints"],
  { tags: [CACHE_TAGS.sprints], revalidate: CACHE_REVALIDATE.list },
);

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
  return sprint;
}

export const getSprintOptions = unstable_cache(
  () =>
    prisma.sprint.findMany({
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true, status: true },
    }),
  ["sprint-options"],
  { tags: [CACHE_TAGS.sprints], revalidate: CACHE_REVALIDATE.options },
);

// ---------- Project (구 Initiative) ----------

export type ProjectSortField =
  | "title"
  | "status"
  | "priority"
  | "dueDate"
  | "createdAt"
  | "updatedAt";

export type ProjectFilter = {
  ownerId?: string;
  sprintId?: string;
  sort?: { field: ProjectSortField; dir: "asc" | "desc" };
};

// 기본 정렬(정렬 지정 없을 때). 상태 오름차 → 최신 생성 우선.
const PROJECT_DEFAULT_ORDER: Prisma.ProjectOrderByWithRelationInput[] = [
  { status: "asc" },
  { createdAt: "desc" },
];

function projectOrderBy(
  sort: ProjectFilter["sort"],
):
  | Prisma.ProjectOrderByWithRelationInput
  | Prisma.ProjectOrderByWithRelationInput[] {
  if (!sort) return PROJECT_DEFAULT_ORDER;
  const dir = sort.dir;
  switch (sort.field) {
    case "title":
      return { title: dir };
    case "status":
      return { status: dir };
    case "priority":
      return { priority: dir };
    case "dueDate":
      // nullable — 방향과 무관하게 미설정은 항상 뒤로.
      return { dueDate: { sort: dir, nulls: "last" } };
    case "createdAt":
      return { createdAt: dir };
    case "updatedAt":
      return { updatedAt: dir };
    default:
      return PROJECT_DEFAULT_ORDER;
  }
}

export const getProjects = unstable_cache(
  async (filter: ProjectFilter = {}) => {
    const projects = await prisma.project.findMany({
      where: {
        ownerId: filter.ownerId,
        sprintId: filter.sprintId,
      },
      orderBy: projectOrderBy(filter.sort),
      include: {
        owner: miniUser,
        sprint: { select: { id: true, name: true, status: true } },
        labels: labelInclude,
        _count: { select: { epics: true } },
      },
    });
    return projects;
  },
  ["projects"],
  { tags: [CACHE_TAGS.projects], revalidate: CACHE_REVALIDATE.list },
);

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

export const getProjectOptions = unstable_cache(
  () =>
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
  ["project-options"],
  { tags: [CACHE_TAGS.projects], revalidate: CACHE_REVALIDATE.options },
);

// ---------- Epic ----------

export type EpicFilter = {
  ownerId?: string;
  teamId?: string;
};

export const getEpics = unstable_cache(
  async (filter: EpicFilter = {}) => {
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
    const ids = epics.map((e) => e.id);
    // 스토리포인트 롤업(하위 태스크 storyPoints 합). Epic 엔 자체 SP 필드가 없어
    // 목록의 StoryPoint 컬럼은 하위 합(읽기전용)으로 표시한다. (MD 롤업은 목록에서
    // 안 쓰므로 계산하지 않음 — 상세 페이지만 rollup 표시.)
    const spGroups = await prisma.task.groupBy({
      by: ["epicId"],
      where: { epicId: { in: ids } },
      _sum: { storyPoints: true },
    });
    const spByEpic = new Map(
      spGroups.map((g) => [g.epicId, g._sum.storyPoints ?? 0]),
    );
    return epics.map((e) => ({
      ...e,
      storyPoints: spByEpic.get(e.id) ?? 0,
    }));
  },
  ["epics"],
  { tags: [CACHE_TAGS.epics], revalidate: CACHE_REVALIDATE.list },
);

export async function getEpic(id: string) {
  const epic = await prisma.epic.findUnique({
    where: { id },
    include: {
      owner: miniUser,
      team: miniTeam,
      project: { select: { id: true, title: true } },
      labels: labelInclude,
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
export const getEpicOptions = unstable_cache(
  () =>
    prisma.epic.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        number: true,
        team: { select: { id: true, key: true } },
      },
    }),
  ["epic-options"],
  { tags: [CACHE_TAGS.epics], revalidate: CACHE_REVALIDATE.options },
);

// ---------- Task ----------

export type BoardFilter = {
  assigneeId?: string;
  teamId?: string;
};

export const getBoardTasks = unstable_cache(
  (filter: BoardFilter = {}) =>
    prisma.task.findMany({
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
        labels: labelInclude,
      },
    }),
  ["board-tasks"],
  { tags: [CACHE_TAGS.tasks], revalidate: CACHE_REVALIDATE.list },
);

export type TaskFilter = {
  status?: Status;
  assigneeId?: string;
  epicId?: string;
  teamId?: string;
  labelId?: string;
  q?: string;
};

export const getTasks = unstable_cache(
  (filter: TaskFilter = {}) =>
    prisma.task.findMany({
      where: {
        status: filter.status,
        assigneeId: filter.assigneeId,
        epicId: filter.epicId,
        teamId: filter.teamId,
        // 라벨 필터: 해당 라벨이 붙은 태스크만(m:n 조인 some).
        labels: filter.labelId
          ? { some: { labelId: filter.labelId } }
          : undefined,
        title: filter.q
          ? { contains: filter.q, mode: "insensitive" }
          : undefined,
      },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
      include: {
        assignee: miniUser,
        team: miniTeam,
        epic: { select: { id: true, title: true } },
        labels: labelInclude,
      },
    }),
  ["tasks"],
  { tags: [CACHE_TAGS.tasks], revalidate: CACHE_REVALIDATE.list },
);

export function getTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      assignee: miniUser,
      reporter: miniUser,
      team: miniTeam,
      labels: labelInclude,
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

// ---------- Label (C8) ----------

/** 라벨 전체 + 사용 카운트(태스크/에픽/프로젝트). 관리 페이지·배지 표시용. 이름순. */
export const getLabels = unstable_cache(
  () =>
    prisma.label.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        _count: { select: { tasks: true, epics: true, projects: true } },
      },
    }),
  ["labels"],
  { tags: [CACHE_TAGS.labels], revalidate: CACHE_REVALIDATE.list },
);

/** 필터/할당 컨트롤용 경량 라벨 옵션(카운트 없음). 이름순. */
export const getLabelOptions = unstable_cache(
  () =>
    prisma.label.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ["label-options"],
  { tags: [CACHE_TAGS.labels], revalidate: CACHE_REVALIDATE.options },
);

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
export const getWikiTree = unstable_cache(
  () =>
    prisma.wikiPage.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        parentId: true,
        folderId: true,
        position: true,
        updatedAt: true,
      },
    }),
  ["wiki-tree"],
  { tags: [CACHE_TAGS.wiki], revalidate: CACHE_REVALIDATE.wiki },
);

/** 휴지통(soft-delete)된 페이지 목록. 최근 삭제순. parentId 로 '삭제 루트'를 화면에서 판별. */
export function getTrashedWikiPages() {
  return prisma.wikiPage.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    select: {
      id: true,
      title: true,
      parentId: true,
      deletedAt: true,
      editor: miniUser,
    },
  });
}

/**
 * 현재 유저의 편집 임시저장본(있으면). 2주(14일) 지난 draft 는 만료로 간주해 null 반환.
 * 페이지 본문보다 최신일 때만 의미가 있으므로 updatedAt 을 함께 돌려준다.
 */
export async function getWikiDraft(pageId: string, userId: string) {
  const draft = await prisma.wikiDraft.findUnique({
    where: { pageId_userId: { pageId, userId } },
    select: { title: true, content: true, updatedAt: true },
  });
  if (!draft) return null;
  const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
  if (Date.now() - draft.updatedAt.getTime() > TWO_WEEKS) return null;
  return draft;
}

/** 문서 폴더(사이드바 그룹핑). 페이지와 별개 타입. */
export const getWikiFolders = unstable_cache(
  () =>
    prisma.wikiFolder.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, parentId: true, position: true },
    }),
  ["wiki-folders"],
  { tags: [CACHE_TAGS.wiki], revalidate: CACHE_REVALIDATE.wiki },
);

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
    where: { userId, page: { deletedAt: null } },
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
  return prisma.wikiPage.findFirst({
    // 휴지통에 있는 페이지는 상세로 열지 않는다(목록/트리에서 이미 숨김).
    where: { id, deletedAt: null },
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
    where: {
      deletedAt: null,
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, title: true },
  });
}

// ---------- 전역 검색 / 커맨드 팔레트 (C7) ----------

/** 커맨드 팔레트에 노출하는 최소 항목. plain-serializable(서버 액션 반환용). */
export type GlobalSearchItem = {
  id: string;
  /** 표시용 주 텍스트(제목/이름). */
  title: string;
  /** 이슈 key(TEAM-n) — 태스크·에픽만. */
  key?: string;
  /** 클릭 시 이동할 상세 경로. */
  href: string;
  /** 보조 텍스트(이메일 등). */
  subtitle?: string;
};

/** 엔티티 그룹별 검색 결과. 각 그룹은 상위 몇 개로 캡. */
export type GlobalSearchResult = {
  tasks: GlobalSearchItem[];
  epics: GlobalSearchItem[];
  projects: GlobalSearchItem[];
  wiki: GlobalSearchItem[];
  users: GlobalSearchItem[];
};

/**
 * 전역 검색(C7). 태스크·에픽·프로젝트·위키·사용자를 가로질러 대소문자 무시
 * contains 로 조회하고, 각 그룹을 상위 CAP 개로 캡한 plain 결과를 반환한다.
 * - 태스크·에픽: 제목 + (숫자/‘TEAM-n’/‘TEAM’ 형태면) key 매칭. searchTasks 규칙 재사용.
 * - 위키: 제목만. 주의: soft-delete(gotchas §8) — deletedAt: null 필수(휴지통 유출 방지).
 * - 사용자: 이름/이메일.
 */
export async function globalSearch(query: string): Promise<GlobalSearchResult> {
  const empty: GlobalSearchResult = {
    tasks: [],
    epics: [],
    projects: [],
    wiki: [],
    users: [],
  };
  const q = query.trim();
  if (!q) return empty;

  const CAP = 5;
  const insensitive = { contains: q, mode: "insensitive" as const };

  // 'TEAM-123' / 'TEAM' / '123' 형태를 이슈 key 매칭으로 해석(searchTasks 와 동일 규칙).
  const dashMatch = q.match(/^([A-Za-z0-9]+)-(\d+)$/);
  const keyOr = (): (
    | import("@prisma/client").Prisma.TaskWhereInput
    | import("@prisma/client").Prisma.EpicWhereInput
  )[] => {
    if (dashMatch) {
      return [
        {
          team: { key: { equals: dashMatch[1], mode: "insensitive" } },
          number: Number(dashMatch[2]),
        },
      ];
    }
    if (/^\d+$/.test(q)) return [{ number: Number(q) }];
    if (/^[A-Za-z]+$/.test(q)) {
      return [{ team: { key: { contains: q, mode: "insensitive" } } }];
    }
    return [];
  };

  const taskOr: import("@prisma/client").Prisma.TaskWhereInput[] = [
    { title: insensitive },
    ...(keyOr() as import("@prisma/client").Prisma.TaskWhereInput[]),
  ];
  const epicOr: import("@prisma/client").Prisma.EpicWhereInput[] = [
    { title: insensitive },
    ...(keyOr() as import("@prisma/client").Prisma.EpicWhereInput[]),
  ];

  const [tasks, epics, projects, wiki, users] = await Promise.all([
    prisma.task.findMany({
      where: { OR: taskOr },
      orderBy: { updatedAt: "desc" },
      take: CAP,
      select: {
        id: true,
        number: true,
        title: true,
        team: { select: { key: true } },
      },
    }),
    prisma.epic.findMany({
      where: { OR: epicOr },
      orderBy: { updatedAt: "desc" },
      take: CAP,
      select: {
        id: true,
        number: true,
        title: true,
        team: { select: { key: true } },
      },
    }),
    prisma.project.findMany({
      where: { title: insensitive },
      orderBy: { updatedAt: "desc" },
      take: CAP,
      select: { id: true, title: true },
    }),
    prisma.wikiPage.findMany({
      where: { deletedAt: null, title: insensitive },
      orderBy: { updatedAt: "desc" },
      take: CAP,
      select: { id: true, title: true },
    }),
    prisma.user.findMany({
      where: { OR: [{ name: insensitive }, { email: insensitive }] },
      orderBy: { name: "asc" },
      take: CAP,
      select: { id: true, name: true, email: true },
    }),
  ]);

  return {
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      key: formatIssueKey(t.team.key, t.number),
      href: `/tasks/${t.id}`,
    })),
    epics: epics.map((e) => ({
      id: e.id,
      title: e.title,
      key: formatIssueKey(e.team.key, e.number),
      href: `/epics/${e.id}`,
    })),
    projects: projects.map((p) => ({
      id: p.id,
      title: p.title,
      href: `/projects/${p.id}`,
    })),
    wiki: wiki.map((w) => ({
      id: w.id,
      title: w.title,
      href: `/wiki/${w.id}`,
    })),
    users: users.map((u) => ({
      id: u.id,
      title: u.name ?? u.email ?? "이름 없음",
      subtitle: u.email ?? undefined,
      href: `/users/${u.id}`,
    })),
  };
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
