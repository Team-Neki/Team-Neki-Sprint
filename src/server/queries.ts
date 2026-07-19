import { prisma } from "@/lib/prisma";
import type { Prisma, Status } from "@prisma/client";
import { formatIssueKey } from "@/lib/constants";
import { searchExcerpt } from "@/lib/rich-content";

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

/**
 * MD 는 Float 라 합산하면 이진 부동소수점 노이즈가 생긴다(예: 0.1+0.2=
 * 0.30000000000000004 → 표에 그대로 노출). 표시용 롤업 출력에만 반올림해 노이즈만
 * 없앤다 — 6자리면 실제 입력값(0.5·2.25 등)은 보존되고 1e-15 수준 오차만 사라진다.
 */
const roundMd = (n: number) => Math.round(n * 1e6) / 1e6;
const roundRollup = (r: MdRollup): MdRollup => ({
  estimated: roundMd(r.estimated),
  actual: roundMd(r.actual),
});

/** 태스크 배열의 estimated/actual MD 합. */
function sumMd(
  tasks: { estimatedMd: number | null; actualMd: number | null }[],
): MdRollup {
  return roundRollup(
    tasks.reduce<MdRollup>(
      (acc, t) => ({
        estimated: acc.estimated + (t.estimatedMd ?? 0),
        actual: acc.actual + (t.actualMd ?? 0),
      }),
      { estimated: 0, actual: 0 },
    ),
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
    map.set(
      r.epicId,
      roundRollup({
        estimated: r._sum.estimatedMd ?? 0,
        actual: r._sum.actualMd ?? 0,
      }),
    );
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

export const getTeams = () =>
  prisma.team.findMany({
    orderBy: { key: "asc" },
    include: {
      members: { ...miniUser, orderBy: { name: "asc" } },
      _count: { select: { epics: true, tasks: true, members: true } },
    },
  });

/** 폼 select 등에 쓰는 팀 옵션(경량). */
export const getTeamOptions = () =>
  prisma.team.findMany({
    orderBy: { key: "asc" },
    select: { id: true, key: true, name: true, color: true },
  });

// ---------- Sprint ----------

export const getSprints = async () => {
  const sprints = await prisma.sprint.findMany({
    orderBy: [{ status: "asc" }, { startDate: "desc" }, { createdAt: "desc" }],
  });
  // 스프린트별 예상 MD 합: Task → Epic → Project → Sprint 로 이어지는 관계를
  // groupBy 로는 못 타므로 raw 집계(태스크 estimatedMd 합)로 계산한다.
  const mdRows = await prisma.$queryRaw<{ sprintId: string; md: number }[]>`
      SELECT p."sprintId" AS "sprintId",
             COALESCE(SUM(t."estimatedMd"), 0)::float8 AS md
      FROM "Task" t
      JOIN "Epic" e ON e.id = t."epicId"
      JOIN "Project" p ON p.id = e."projectId"
      WHERE p."sprintId" IS NOT NULL
      GROUP BY p."sprintId"
    `;
  const mdBySprint = new Map(mdRows.map((r) => [r.sprintId, roundMd(r.md)]));
  return sprints.map((s) => ({ ...s, estimatedMd: mdBySprint.get(s.id) ?? 0 }));
};

export async function getSprint(id: string) {
  const sprint = await prisma.sprint.findUnique({
    where: { id },
    include: {
      projects: {
        // 기본 정렬: 상태 내림차(DONE→IN_PROGRESS→TODO→BACKLOG) → 최신 생성 우선.
        orderBy: [{ status: "desc" }, { createdAt: "desc" }],
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

export const getSprintOptions = () =>
  prisma.sprint.findMany({
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true, status: true },
  });

// ---------- Project (구 Initiative) ----------

export type ProjectSortField =
  "title" | "status" | "priority" | "dueDate" | "createdAt" | "updatedAt";

export type ProjectFilter = {
  ownerId?: string[];
  sprintId?: string[];
  sort?: { field: ProjectSortField; dir: "asc" | "desc" };
};

// 기본 정렬(정렬 지정 없을 때). 상태 내림차(DONE→IN_PROGRESS→TODO→BACKLOG) → 최신 생성 우선.
const PROJECT_DEFAULT_ORDER: Prisma.ProjectOrderByWithRelationInput[] = [
  { status: "desc" },
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

export const getProjects = async (filter: ProjectFilter = {}) => {
  const projects = await prisma.project.findMany({
    where: {
      ownerId:
        filter.ownerId && filter.ownerId.length
          ? { in: filter.ownerId }
          : undefined,
      sprintId:
        filter.sprintId && filter.sprintId.length
          ? { in: filter.sprintId }
          : undefined,
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
};

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
  const md = roundRollup(
    epics.reduce<MdRollup>(
      (a, e) => ({
        estimated: a.estimated + e.md.estimated,
        actual: a.actual + e.md.actual,
      }),
      { estimated: 0, actual: 0 },
    ),
  );
  return { ...project, epics, md };
}

export const getProjectOptions = () =>
  prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });

// ---------- Epic ----------

export type EpicFilter = {
  ownerId?: string[];
  teamId?: string[];
};

export const getEpics = async (filter: EpicFilter = {}) => {
  const epics = await prisma.epic.findMany({
    where: {
      ownerId:
        filter.ownerId && filter.ownerId.length
          ? { in: filter.ownerId }
          : undefined,
      teamId:
        filter.teamId && filter.teamId.length
          ? { in: filter.teamId }
          : undefined,
    },
    // 기본 정렬: 상태 내림차(DONE→IN_PROGRESS→TODO→BACKLOG) → 최신 생성 우선.
    orderBy: [{ status: "desc" }, { createdAt: "desc" }],
    include: {
      owner: miniUser,
      team: miniTeam,
      project: { select: { id: true, title: true } },
      labels: labelInclude,
      _count: { select: { tasks: true } },
    },
  });
  const ids = epics.map((e) => e.id);
  // MD 롤업(하위 태스크 estimatedMd 합). Epic 엔 자체 MD 필드가 없어
  // 목록의 MD 컬럼은 하위 예상 MD 합(읽기전용)으로 표시한다.
  const mdGroups = await prisma.task.groupBy({
    by: ["epicId"],
    where: { epicId: { in: ids } },
    _sum: { estimatedMd: true },
  });
  const mdByEpicId = new Map(
    mdGroups.map((g) => [g.epicId, roundMd(g._sum.estimatedMd ?? 0)]),
  );
  return epics.map((e) => ({
    ...e,
    estimatedMd: mdByEpicId.get(e.id) ?? 0,
  }));
};

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
export const getEpicOptions = () =>
  prisma.epic.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      number: true,
      team: { select: { id: true, key: true } },
    },
  });

// ---------- Task ----------

export type BoardFilter = {
  assigneeId?: string[];
  teamId?: string[];
};

export const getBoardTasks = async (filter: BoardFilter = {}) => {
  const rows = await prisma.task.findMany({
    where: {
      assigneeId:
        filter.assigneeId && filter.assigneeId.length
          ? { in: filter.assigneeId }
          : undefined,
      teamId:
        filter.teamId && filter.teamId.length
          ? { in: filter.teamId }
          : undefined,
    },
    // 칸반 컬럼 내 순서(B7-board). 재정렬로 부여한 boardOrder 우선, 미정렬(null)은 하단.
    // id 최종 tiebreaker 로 동점(boardOrder null + 같은 createdAt) 카드의 순서 흔들림 방지.
    orderBy: [
      { boardOrder: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
      { id: "asc" },
    ],
    include: {
      assignee: miniUser,
      team: miniTeam,
      epic: { select: { id: true, title: true } },
      labels: labelInclude,
      // 차단됨 배지용: 미완료 blocker 존재 여부만 계산(상태만 로드).
      blockedBy: { select: { blocker: { select: { status: true } } } },
    },
  });
  return rows.map(({ blockedBy, ...t }) => ({
    ...t,
    blocked: blockedBy.some((d) => d.blocker.status !== "DONE"),
  }));
};

export type TaskFilter = {
  status?: Status[];
  assigneeId?: string[];
  epicId?: string;
  teamId?: string[];
  labelId?: string[];
  q?: string;
};

export const getTasks = async (filter: TaskFilter = {}) => {
  const rows = await prisma.task.findMany({
    where: {
      status:
        filter.status && filter.status.length
          ? { in: filter.status }
          : undefined,
      assigneeId:
        filter.assigneeId && filter.assigneeId.length
          ? { in: filter.assigneeId }
          : undefined,
      epicId: filter.epicId,
      teamId:
        filter.teamId && filter.teamId.length
          ? { in: filter.teamId }
          : undefined,
      // 라벨 필터: 선택된 라벨 중 하나라도 붙은 태스크만(m:n 조인 some + in).
      labels:
        filter.labelId && filter.labelId.length
          ? { some: { labelId: { in: filter.labelId } } }
          : undefined,
      title: filter.q ? { contains: filter.q, mode: "insensitive" } : undefined,
    },
    // 기본 정렬: 상태 내림차(DONE→IN_PROGRESS→TODO→BACKLOG) 우선.
    // id 를 마지막 tiebreaker 로 추가 → (status,priority,createdAt) 동점 행들도
    // 결정적 순서 보장. 없으면 MD 등 수정 시 동점 구간이 재배열돼 순서가 흔들린다.
    orderBy: [
      { status: "desc" },
      { priority: "asc" },
      { createdAt: "desc" },
      { id: "asc" },
    ],
    include: {
      assignee: miniUser,
      team: miniTeam,
      epic: { select: { id: true, title: true } },
      labels: labelInclude,
      // 차단됨 배지용: 미완료 blocker 존재 여부만 계산(상태만 로드).
      blockedBy: { select: { blocker: { select: { status: true } } } },
    },
  });
  return rows.map(({ blockedBy, ...t }) => ({
    ...t,
    blocked: blockedBy.some((d) => d.blocker.status !== "DONE"),
  }));
};

export function getTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      assignee: miniUser,
      reporter: miniUser,
      // 참조(c.c.) 수신자 목록. 이름순.
      ccUsers: { ...miniUser, orderBy: { name: "asc" } },
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
      // 최신순(최신 댓글이 위)으로 조회 — getEntityComments 와 정렬 일치.
      comments: {
        orderBy: { createdAt: "desc" },
        include: { author: miniUser },
      },
      // 연결된 위키(#3).
      wikiLinks: {
        include: { page: { select: { id: true, title: true } } },
      },
      // 의존성: blockedBy=나를 막는 태스크들(blocker), blocking=내가 막는 태스크들(blocked).
      blockedBy: {
        orderBy: { createdAt: "asc" },
        include: {
          blocker: {
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
      blocking: {
        orderBy: { createdAt: "asc" },
        include: {
          blocked: {
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
    },
  });
}

/** 태스크에 연결된 GitHub 브랜치/PR 링크. 최신순. */
export function getTaskGithubLinks(taskId: string) {
  return prisma.githubBranchLink.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      repoFullName: true,
      branchName: true,
      branchUrl: true,
      prNumber: true,
      prState: true,
      prUrl: true,
    },
  });
}

// ---------- Comment (task/epic/project/sprint 공용, 다형) ----------

/**
 * 엔티티(task/epic/project/sprint)의 댓글 목록. **최신순(createdAt desc — 최신이 위)**
 * + 작성자. 대댓글 없이 플랫. 다형 Comment 라 엔티티별 FK 컬럼으로 필터한다.
 */
export function getEntityComments(
  entityType: "task" | "epic" | "project" | "sprint",
  id: string,
) {
  const where =
    entityType === "task"
      ? { taskId: id }
      : entityType === "epic"
        ? { epicId: id }
        : entityType === "project"
          ? { projectId: id }
          : { sprintId: id };
  return prisma.comment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { author: miniUser },
  });
}

// ---------- Label (C8) ----------

/** 라벨 전체 + 사용 카운트(태스크/에픽/프로젝트). 관리 페이지·배지 표시용. 이름순. */
export const getLabels = () =>
  prisma.label.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      _count: { select: { tasks: true, epics: true, projects: true } },
    },
  });

/** 필터/할당 컨트롤용 경량 라벨 옵션(카운트 없음). 이름순. */
export const getLabelOptions = () =>
  prisma.label.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });

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

/** Full page tree (small dataset for a 20-person team).
 * 초안(isDraft)은 작성자에게만 보인다 — userId 는 그 필터용. */
export const getWikiTree = (userId: string) =>
  prisma.wikiPage.findMany({
    where: {
      deletedAt: null,
      OR: [{ isDraft: false }, { authorId: userId }],
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      parentId: true,
      folderId: true,
      position: true,
      updatedAt: true,
      isDraft: true,
    },
  });

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
export const getWikiFolders = () =>
  prisma.wikiFolder.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, parentId: true, position: true },
  });

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
 * 엔티티(sprint/project/epic)에 연결된 위키 페이지 목록. 태스크의 wikiLinks include
 * (getTask)와 동형이나, 엔티티 상세는 각자 getSprint/getProject/getEpic 를 쓰므로
 * 그 include 를 건드리지 않고 별도 조회로 분리한다(연결 mutation 후 revalidate 로 fresh).
 * 초안/휴지통 페이지도 이미 연결됐다면 그대로 노출한다(연결 시점 검색이 이미 걸러냄).
 */
export async function getEntityWikiLinks(
  entityType: "epic" | "project" | "sprint",
  id: string,
): Promise<{ id: string; title: string }[]> {
  const pageSelect = { page: { select: { id: true, title: true } } } as const;
  if (entityType === "epic") {
    const rows = await prisma.wikiPageEpicLink.findMany({
      where: { epicId: id },
      select: pageSelect,
    });
    return rows.map((r) => r.page);
  }
  if (entityType === "project") {
    const rows = await prisma.wikiPageProjectLink.findMany({
      where: { projectId: id },
      select: pageSelect,
    });
    return rows.map((r) => r.page);
  }
  const rows = await prisma.wikiPageSprintLink.findMany({
    where: { sprintId: id },
    select: pageSelect,
  });
  return rows.map((r) => r.page);
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
      // 초안은 링크 검색에 노출하지 않는다(아직 공개 전 문서).
      isDraft: false,
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
 * - 위키: 제목 + 본문(searchText). 본문만 매칭 시 subtitle 에 발췌 표시. 주의:
 *   soft-delete(gotchas §8) — deletedAt: null 필수(휴지통 유출 방지).
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
      // 제목 + 본문(searchText) 매칭. 휴지통 제외(gotchas §8) + 초안 제외.
      where: {
        deletedAt: null,
        isDraft: false,
        OR: [{ title: insensitive }, { searchText: insensitive }],
      },
      orderBy: { updatedAt: "desc" },
      take: CAP,
      select: { id: true, title: true, searchText: true },
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
    wiki: wiki.map((w) => {
      // 제목에 이미 매칭되면 발췌 불필요. 본문에서만 매칭됐을 때 왜 떴는지 보이게 발췌.
      const titleHit = w.title.toLowerCase().includes(q.toLowerCase());
      const bodyHit = (w.searchText ?? "")
        .toLowerCase()
        .includes(q.toLowerCase());
      return {
        id: w.id,
        title: w.title,
        subtitle:
          !titleHit && bodyHit ? searchExcerpt(w.searchText, q) : undefined,
        href: `/wiki/${w.id}`,
      };
    }),
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

/**
 * '@' 멘션 드롭다운용 통합 검색: 멤버(이름/이메일) + 팀(이름/key) + 위키(제목).
 * 팀을 고르면 팀 전원에게 알림이 가므로(teamMention) 팀은 소수만 노출한다.
 * 위키 멘션은 링크 칩일 뿐 알림을 보내지 않는다(티켓 멘션과 동일).
 */
export async function searchMentionTargets(query: string) {
  const q = query.trim();
  const [users, teams, wiki] = await Promise.all([
    searchMembers(query),
    prisma.team.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { key: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
      take: 4,
      select: {
        id: true,
        key: true,
        name: true,
        _count: { select: { members: true } },
      },
    }),
    // 소프트 삭제(휴지통)·초안 문서는 노출 금지(gotchas §8). deletedAt/isDraft 필터 필수.
    prisma.wikiPage.findMany({
      where: {
        deletedAt: null,
        isDraft: false,
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true },
    }),
  ]);
  return { users, teams, wiki };
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
      github: true,
      figma: true,
      role: true,
      team: { select: { id: true, key: true, name: true, color: true } },
      assignedTasks: {
        where: { status: { not: "DONE" } },
        // 기본 정렬: 상태 내림차(IN_PROGRESS→TODO→BACKLOG, DONE 제외) → 최신 생성 우선.
        orderBy: [{ status: "desc" }, { createdAt: "desc" }],
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
        // 기본 정렬: 상태 내림차(DONE→IN_PROGRESS→TODO→BACKLOG) → 최신 생성 우선.
        orderBy: [{ status: "desc" }, { createdAt: "desc" }],
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

// ---------- 공지(Announcement) ----------

/** 공지 목록(최신순). 대시보드(limit 지정)와 전체 목록이 공유. */
export function getAnnouncements(limit?: number) {
  return prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      author: miniUser,
    },
  });
}

/** 공지 상세(본문 포함). */
export function getAnnouncement(id: string) {
  return prisma.announcement.findUnique({
    where: { id },
    include: { author: miniUser },
  });
}

export async function getDashboardData(userId: string) {
  // "최근 활동" 개인화(나와 관련된 것만): 내가 담당/보고자인 태스크, 내가 오너인 에픽,
  // 내가 작성한 위키에 일어난 활동 + 나를 멘션한 알림. 먼저 내 엔티티 id 를 모은다.
  const [myTaskRows, myEpicRows, myWikiRows] = await Promise.all([
    prisma.task.findMany({
      where: { OR: [{ assigneeId: userId }, { reporterId: userId }] },
      select: { id: true },
    }),
    prisma.epic.findMany({ where: { ownerId: userId }, select: { id: true } }),
    prisma.wikiPage.findMany({
      where: { authorId: userId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  const myTaskIdSet = myTaskRows.map((t) => t.id);
  const myEpicIdSet = myEpicRows.map((e) => e.id);
  const myWikiIdSet = myWikiRows.map((w) => w.id);

  const [
    statusCounts,
    totalTasks,
    myTasks,
    myActivityRaw,
    mentionRaw,
    projects,
  ] = await Promise.all([
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
    // 나와 관련된 엔티티에 일어난 활동(행위자 무관 — 남이 내 티켓을 수정해도 뜬다).
    prisma.activity.findMany({
      where: {
        OR: [
          { entityType: "task", entityId: { in: myTaskIdSet } },
          { entityType: "epic", entityId: { in: myEpicIdSet } },
          { entityType: "wiki", entityId: { in: myWikiIdSet } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { user: miniUser },
    }),
    // 나를 멘션한 알림(활동 피드에 함께 노출).
    prisma.notification.findMany({
      where: { userId, type: "mention" },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { actor: miniUser },
    }),
    prisma.project.findMany({
      where: { status: { not: "DONE" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { _count: { select: { epics: true } } },
    }),
  ]);

  // 멘션 알림을 활동 항목과 같은 모양으로 정규화(actor=행위자, action="mentioned",
  // 제목=notification.context=페이지/티켓 제목). 그 뒤 활동과 병합해 최신순 12개.
  const mentionItems = mentionRaw.map((n) => ({
    id: `mention:${n.id}`,
    user: n.actor,
    entityType: n.entityType,
    entityId: n.entityId,
    action: "mentioned" as const,
    meta: null as unknown,
    createdAt: n.createdAt,
    mentionTitle: n.context,
  }));
  const recentActivityRaw = [
    ...myActivityRaw.map((a) => ({
      ...a,
      mentionTitle: null as string | null,
    })),
    ...mentionItems,
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 12);

  // 최근 활동 enrich: 티켓 key(TEAM-n) + 엔티티 제목 + 값 해석용 lookup.
  // entityId 는 폴리모픽이라 task/epic 은 모아서 조회, 나머지 이름은 lookup 으로 해석.
  const taskIds = recentActivityRaw
    .filter((a) => a.entityType === "task")
    .map((a) => a.entityId);
  const epicIds = recentActivityRaw
    .filter((a) => a.entityType === "epic")
    .map((a) => a.entityId);
  const wikiIds = recentActivityRaw
    .filter((a) => a.entityType === "wiki")
    .map((a) => a.entityId);
  const [
    actTasks,
    actEpics,
    actWikis,
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
    // 위키 활동에 "어떤 페이지인지" 제목을 붙인다. 휴지통(deletedAt≠null) 페이지도
    // 포함 — 목록/검색 유출(gotchas §8)이 아니라 이미 노출된 활동 이력의 제목 보강이며,
    // 제외하면 방금 삭제된 페이지의 과거 수정 활동이 제목 없이 뜬다.
    wikiIds.length
      ? prisma.wikiPage.findMany({
          where: { id: { in: wikiIds } },
          select: { id: true, title: true },
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
  for (const w of actWikis) titleMap.set(w.id, w.title);
  for (const p of lookupProjects) titleMap.set(p.id, p.title);
  for (const s of lookupSprints) titleMap.set(s.id, s.name);

  const recentActivity = recentActivityRaw.map((a) => ({
    ...a,
    entityKey: keyMap.get(a.entityId) ?? null,
    // 멘션 항목은 위키 제목이 lookup 에 없으므로 notification.context(mentionTitle) 로 보완.
    entityTitle: titleMap.get(a.entityId) ?? a.mentionTitle ?? null,
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
