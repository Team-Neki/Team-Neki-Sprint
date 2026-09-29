# 하위 태스크 진행률 롤업 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 에픽·프로젝트·스프린트 상세와 목록에서 하위 태스크 진행률(완료/진행 중/할 일)을 요약 줄과 표 컬럼으로 보여준다. (BACKEND-160)

**Architecture:** 순수 계산은 `src/lib/task-progress.ts`. `src/server/queries.ts` 의 기존 MD 롤업 쿼리를 `(key, status)` 단위 집계로 바꿔 MD 와 상태 개수를 한 번에 얻고, 모든 롤업 소비처(목록 3 + 상세 3)에 `progress` 를 싣는다. 표시는 서버 컴포넌트 `src/components/detail/task-progress.tsx` 하나.

**Tech Stack:** Next.js 16 App Router(서버 컴포넌트), Prisma 6(PostgreSQL, `groupBy` + `$queryRaw`), Tailwind v4, vitest.

설계: `docs/superpowers/specs/2026-09-30-task-progress-rollup-design.md` · 완료 판정: `docs/oracle/task-progress-rollup.md`

---

## File Structure

| 파일 | 책임 |
|---|---|
| Create `src/lib/task-progress.ts` | `TaskProgress` 타입, 개수 세기·합·% 계산(순수) |
| Create `src/lib/task-progress.test.ts` | 위 순수 로직 경계값 |
| Modify `src/server/queries.ts` | `foldRollups`·`rollupByEpic`·`rollupByProject`·`rollupBySprint`, `mdByEpic` 제거, 6개 쿼리에 `progress` |
| Create `src/components/detail/task-progress.tsx` | `TaskProgressSummary`(상세), `TaskProgressCell`(표) |
| Modify `src/components/tables/{epic,project,sprint}-columns.tsx` | 행 타입 `progress` 필수 + `progress` 컬럼 |
| Modify `src/app/(app)/{epics,projects,sprints}/[id]/page.tsx` | 요약 렌더 |
| Modify `docs/design-system.md`, `docs/work-log.md`, `docs/README.md` | 규격·이력·인덱스 |

---

### Task 1: 순수 진행률 로직

**Files:**
- Create: `src/lib/task-progress.ts`
- Test: `src/lib/task-progress.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import {
  EMPTY_PROGRESS,
  countStatuses,
  progressPercent,
  progressTotal,
  sumProgress,
} from "./task-progress";

describe("countStatuses", () => {
  it("상태별로 센다", () => {
    expect(
      countStatuses([
        { status: "DONE" },
        { status: "TODO" },
        { status: "DONE" },
        { status: "IN_PROGRESS" },
      ]),
    ).toEqual({ TODO: 1, IN_PROGRESS: 1, DONE: 2 });
  });

  it("빈 배열은 전부 0", () => {
    expect(countStatuses([])).toEqual({ TODO: 0, IN_PROGRESS: 0, DONE: 0 });
  });

  it("EMPTY_PROGRESS 를 변형하지 않는다", () => {
    countStatuses([{ status: "DONE" }]);
    expect(EMPTY_PROGRESS).toEqual({ TODO: 0, IN_PROGRESS: 0, DONE: 0 });
  });
});

describe("sumProgress", () => {
  it("상태별로 더한다", () => {
    expect(
      sumProgress([
        { TODO: 1, IN_PROGRESS: 2, DONE: 3 },
        { TODO: 4, IN_PROGRESS: 0, DONE: 1 },
      ]),
    ).toEqual({ TODO: 5, IN_PROGRESS: 2, DONE: 4 });
  });

  it("빈 목록은 전부 0", () => {
    expect(sumProgress([])).toEqual({ TODO: 0, IN_PROGRESS: 0, DONE: 0 });
  });
});

describe("progressTotal", () => {
  it("세 상태의 합", () => {
    expect(progressTotal({ TODO: 1, IN_PROGRESS: 2, DONE: 3 })).toBe(6);
  });
});

describe("progressPercent", () => {
  it("0건이면 null", () => {
    expect(progressPercent({ TODO: 0, IN_PROGRESS: 0, DONE: 0 })).toBeNull();
  });

  it("내림한다(1/3 → 33, 2/3 → 66)", () => {
    expect(progressPercent({ TODO: 2, IN_PROGRESS: 0, DONE: 1 })).toBe(33);
    expect(progressPercent({ TODO: 1, IN_PROGRESS: 0, DONE: 2 })).toBe(66);
  });

  it("모두 끝나기 전엔 100 이 아니다(199/200 → 99)", () => {
    expect(progressPercent({ TODO: 1, IN_PROGRESS: 0, DONE: 199 })).toBe(99);
  });

  it("모두 완료면 100", () => {
    expect(progressPercent({ TODO: 0, IN_PROGRESS: 0, DONE: 5 })).toBe(100);
  });

  it("진행 중은 % 에 넣지 않는다", () => {
    expect(progressPercent({ TODO: 0, IN_PROGRESS: 3, DONE: 1 })).toBe(25);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/task-progress.test.ts`
Expected: FAIL — `Failed to resolve import "./task-progress"`

- [ ] **Step 3: 구현**

```ts
import type { Status } from "@prisma/client";

/** 상태별 태스크 개수. 에픽·프로젝트·스프린트의 하위 태스크 진행률 롤업(BACKEND-160). */
export type TaskProgress = Record<Status, number>;

export const EMPTY_PROGRESS: TaskProgress = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };

export function countStatuses(items: { status: Status }[]): TaskProgress {
  const p = { ...EMPTY_PROGRESS };
  for (const { status } of items) p[status] += 1;
  return p;
}

export function sumProgress(list: TaskProgress[]): TaskProgress {
  const p = { ...EMPTY_PROGRESS };
  for (const x of list) {
    p.TODO += x.TODO;
    p.IN_PROGRESS += x.IN_PROGRESS;
    p.DONE += x.DONE;
  }
  return p;
}

export const progressTotal = (p: TaskProgress) =>
  p.TODO + p.IN_PROGRESS + p.DONE;

/**
 * 완료 비율(%). 내림이라 모두 완료일 때만 100 이 된다(반올림하면 199/200 이 100% 로 보임).
 * 진행 중은 포함하지 않는다. 0건이면 null.
 */
export function progressPercent(p: TaskProgress): number | null {
  const total = progressTotal(p);
  return total === 0 ? null : Math.floor((p.DONE * 100) / total);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/task-progress.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/task-progress.ts src/lib/task-progress.test.ts
git commit -m "feat(progress): 하위 태스크 진행률 순수 계산 (BACKEND-160)"
```

---

### Task 2: 롤업 쿼리에 상태 개수 싣기

**Files:**
- Modify: `src/server/queries.ts` (MD 롤업 섹션 54-106, `getSprints` 166-200, `getSprint` 202-237, `getProjects` 280-321, `getProject` 323-364, `getEpics` 392-440, `getEpic` 442-470)

- [ ] **Step 1: import 추가** — 파일 상단 import 블록 끝에

```ts
import {
  EMPTY_PROGRESS,
  countStatuses,
  sumProgress,
  type TaskProgress,
} from "@/lib/task-progress";
```

- [ ] **Step 2: `mdByEpic`(86-106) 를 롤업 헬퍼로 교체**

```ts
/** 하위 태스크 롤업: MD 합 + 상태별 개수. */
export type TaskRollup = { md: MdRollup; progress: TaskProgress };
const ZERO_ROLLUP: TaskRollup = { md: ZERO_MD, progress: EMPTY_PROGRESS };

type RollupRow = {
  key: string | null;
  status: Status;
  n: number;
  estimated: number;
  actual: number;
};

/** (key, status) 단위 집계 행을 key 별 롤업으로 접는다. */
function foldRollups(rows: RollupRow[]): Map<string, TaskRollup> {
  const map = new Map<string, TaskRollup>();
  for (const r of rows) {
    if (!r.key) continue;
    const cur = map.get(r.key) ?? {
      md: { estimated: 0, actual: 0 },
      progress: { ...EMPTY_PROGRESS },
    };
    cur.md = {
      estimated: cur.md.estimated + r.estimated,
      actual: cur.md.actual + r.actual,
    };
    cur.progress[r.status] += r.n;
    map.set(r.key, cur);
  }
  for (const v of map.values()) v.md = roundRollup(v.md);
  return map;
}

/** 에픽 id별 하위 태스크 롤업. */
async function rollupByEpic(epicIds: string[]): Promise<Map<string, TaskRollup>> {
  if (epicIds.length === 0) return new Map();
  const rows = await prisma.task.groupBy({
    by: ["epicId", "status"],
    where: { epicId: { in: epicIds } },
    _count: { _all: true },
    _sum: { estimatedMd: true, actualMd: true },
  });
  return foldRollups(
    rows.map((r) => ({
      key: r.epicId,
      status: r.status,
      n: r._count._all,
      estimated: r._sum.estimatedMd ?? 0,
      actual: r._sum.actualMd ?? 0,
    })),
  );
}

/** 프로젝트 id별 하위(에픽→태스크) 롤업. groupBy 로는 한 단계 더 못 내려가 raw 집계. */
async function rollupByProject(
  projectIds: string[],
): Promise<Map<string, TaskRollup>> {
  if (projectIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<RollupRow[]>`
      SELECT e."projectId" AS "key",
             t.status AS "status",
             COUNT(*)::int AS "n",
             COALESCE(SUM(t."estimatedMd"), 0)::float8 AS "estimated",
             COALESCE(SUM(t."actualMd"), 0)::float8 AS "actual"
      FROM "Task" t
      JOIN "Epic" e ON e.id = t."epicId"
      WHERE e."projectId" = ANY(${projectIds})
      GROUP BY e."projectId", t.status
    `;
  return foldRollups(rows);
}

/** 스프린트 id별 하위(프로젝트→에픽→태스크) 롤업. */
async function rollupBySprint(
  sprintIds: string[],
): Promise<Map<string, TaskRollup>> {
  if (sprintIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<RollupRow[]>`
      SELECT p."sprintId" AS "key",
             t.status AS "status",
             COUNT(*)::int AS "n",
             COALESCE(SUM(t."estimatedMd"), 0)::float8 AS "estimated",
             COALESCE(SUM(t."actualMd"), 0)::float8 AS "actual"
      FROM "Task" t
      JOIN "Epic" e ON e.id = t."epicId"
      JOIN "Project" p ON p.id = e."projectId"
      WHERE p."sprintId" = ANY(${sprintIds})
      GROUP BY p."sprintId", t.status
    `;
  return foldRollups(rows);
}
```

- [ ] **Step 3: `getSprints` — `mdRows` 블록(181-196) 교체**

```ts
  // 스프린트별 하위 태스크 롤업(Task → Epic → Project → Sprint, raw 집계).
  const rollups = await rollupBySprint(sprints.map((s) => s.id));
  const rows = sprints.map((s) => {
    const r = rollups.get(s.id) ?? ZERO_ROLLUP;
    return { ...s, estimatedMd: r.md.estimated, progress: r.progress };
  });
```

- [ ] **Step 4: `getSprint` — 프로젝트 행에 롤업, 상위 합계**

`if (!sprint) return null;` 바로 뒤에 추가:

```ts
  // 하위 프로젝트별 롤업(표의 MD·진행률 셀) + 스프린트 진행률(행 합).
  const perProject = await rollupByProject(sprint.projects.map((p) => p.id));
  const projects = sprint.projects.map((p) => {
    const r = perProject.get(p.id) ?? ZERO_ROLLUP;
    return { ...p, estimatedMd: r.md.estimated, progress: r.progress };
  });
```

마지막 return 을 다음으로:

```ts
  return {
    ...sprint,
    projects: orderByDefaultStatus(projects),
    md,
    progress: sumProgress(projects.map((p) => p.progress)),
  };
```

- [ ] **Step 5: `getProjects` — `mdRows` 블록(304-316) 교체**

```ts
  // 프로젝트별 하위(에픽 → 태스크) 롤업.
  const rollups = await rollupByProject(projects.map((p) => p.id));
  const rows = projects.map((p) => {
    const r = rollups.get(p.id) ?? ZERO_ROLLUP;
    return { ...p, estimatedMd: r.md.estimated, progress: r.progress };
  });
```

- [ ] **Step 6: `getProject` — `mdByEpic` 대신 `rollupByEpic`**

```ts
  // 하위 에픽별 롤업(MD·진행률) + 프로젝트 총합(읽기전용).
  const perEpic = await rollupByEpic(project.epics.map((e) => e.id));
  // 기본 정렬: 진행중 → 할 일 → 완료(각 그룹 내 우선순위 desc → 생성일 desc).
  const epics = orderByDefaultStatus(
    project.epics.map((e) => {
      const r = perEpic.get(e.id) ?? ZERO_ROLLUP;
      return {
        ...e,
        md: r.md,
        estimatedMd: r.md.estimated,
        progress: r.progress,
      };
    }),
  );
```

return 을 `return { ...project, epics, md, progress: sumProgress(epics.map((e) => e.progress)) };` 로.

- [ ] **Step 7: `getEpics` — `ids`·`mdGroups`·`mdByEpicId` 블록(425-437) 교체**

```ts
  // 에픽별 하위 태스크 롤업(MD 합 + 진행률). Epic 엔 자체 MD 필드가 없다.
  const rollups = await rollupByEpic(epics.map((e) => e.id));
  const rows = epics.map((e) => {
    const r = rollups.get(e.id) ?? ZERO_ROLLUP;
    return { ...e, estimatedMd: r.md.estimated, progress: r.progress };
  });
```

- [ ] **Step 8: `getEpic` — return 에 `progress: countStatuses(epic.tasks)` 추가**

- [ ] **Step 9: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 종료코드 0 (Task 4 전까지 컬럼 타입은 아직 progress 를 요구하지 않으므로 통과해야 함)

- [ ] **Step 10: Commit**

```bash
git add src/server/queries.ts
git commit -m "feat(progress): MD 롤업 쿼리에 상태별 개수 집계 추가 (BACKEND-160)"
```

---

### Task 3: 진행률 표시 컴포넌트

**Files:**
- Create: `src/components/detail/task-progress.tsx`

- [ ] **Step 1: 트랙 토큰 확인** — `grep -n "color-border" src/app/globals.css` 가 `--color-border: var(--border)` 를 보여야 `bg-border` 가 생성된다. 없으면 트랙 클래스를 `bg-muted` 로.

- [ ] **Step 2: 구현**

```tsx
import { STATUS_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  progressPercent,
  progressTotal,
  type TaskProgress,
} from "@/lib/task-progress";

/**
 * 완료(emerald)·진행 중(amber) 구간을 채운 막대. 남는 트랙이 할 일이다.
 * 트랙은 hairline(#ebebeb) — canvas(#fafafa)·카드(#ffffff) 어디서든 보이도록.
 * total > 0 일 때만 렌더한다.
 */
function ProgressBar({
  progress,
  className,
}: {
  progress: TaskProgress;
  className?: string;
}) {
  const total = progressTotal(progress);
  const pct = progressPercent(progress) ?? 0;
  const width = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={`진행률 ${pct}%`}
      className={cn(
        "bg-border flex h-1.5 shrink-0 overflow-hidden rounded-full",
        className,
      )}
    >
      <div
        className={STATUS_META.DONE.dot}
        style={{ width: width(progress.DONE) }}
      />
      <div
        className={STATUS_META.IN_PROGRESS.dot}
        style={{ width: width(progress.IN_PROGRESS) }}
      />
    </div>
  );
}

/**
 * 상세의 하위 목록 헤더와 표 사이에 두는 진행 요약(BACKEND-160).
 * 에픽·프로젝트·스프린트 모두 최하위 태스크까지 롤업한 개수라 "태스크 N개 중" 으로 기준을 밝힌다.
 */
export function TaskProgressSummary({ progress }: { progress: TaskProgress }) {
  const total = progressTotal(progress);
  if (total === 0) {
    return <p className="text-muted-foreground mb-3 text-xs">태스크 없음</p>;
  }
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <ProgressBar progress={progress} className="w-32 sm:w-48" />
      <span className="font-medium tabular-nums">
        {progressPercent(progress)}%
      </span>
      <span className="text-muted-foreground tabular-nums">
        태스크 {total}개 중 {STATUS_META.DONE.label} {progress.DONE} ·{" "}
        {STATUS_META.IN_PROGRESS.label} {progress.IN_PROGRESS} ·{" "}
        {STATUS_META.TODO.label} {progress.TODO}
      </span>
    </div>
  );
}

/** 표 셀: 작은 막대 + 완료/전체. 태스크가 없으면 "—". */
export function TaskProgressCell({ progress }: { progress: TaskProgress }) {
  const total = progressTotal(progress);
  if (total === 0) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  return (
    <span className="flex items-center gap-2">
      <ProgressBar progress={progress} className="w-14" />
      <span className="text-muted-foreground text-xs tabular-nums">
        {progress.DONE}/{total}
      </span>
    </span>
  );
}
```

- [ ] **Step 3: 렌더 확인(임시, 커밋 안 함)** — `src/components/detail/zz-render.test.ts` 로 `react-dom/server` `renderToStaticMarkup` 를 써서 (a) 0건 셀이 `—`, (b) `{TODO:3,IN_PROGRESS:3,DONE:4}` 셀이 `4/10`·`aria-valuenow="40"`·완료 구간 `width:40%`, (c) 요약에 `40%`·`태스크 10개 중 완료 4 · 진행 중 3 · 할 일 3` 이 포함됨을 단언. 통과 후 파일 삭제.

- [ ] **Step 4: Commit**

```bash
git add src/components/detail/task-progress.tsx
git commit -m "feat(progress): 진행률 요약·표 셀 컴포넌트 (BACKEND-160)"
```

---

### Task 4: 표 컬럼

**Files:**
- Modify: `src/components/tables/epic-columns.tsx`, `project-columns.tsx`, `sprint-columns.tsx`

- [ ] **Step 1: 세 파일 공통 import**

```ts
import { TaskProgressCell } from "@/components/detail/task-progress";
import type { TaskProgress } from "@/lib/task-progress";
```

- [ ] **Step 2: 행 타입에 필수 필드**

`EpicTableRow`·`ProjectTableRow`·`SprintTableRow` 에:

```ts
  /** 하위 태스크 상태별 개수(읽기전용 롤업, BACKEND-160). */
  progress: TaskProgress;
```

`EpicTableRow`·`ProjectTableRow` 의 `estimatedMd` 주석에서 "목록(getX)에서만 계산 — 하위목록에선 생략(→ "—")" 를 "목록과 상위 상세의 하위 표 모두 계산" 으로 고친다. `project-columns.tsx` MD 셀 위 주석(하위목록 생략)도 같은 뜻으로.

- [ ] **Step 3: 컬럼 추가** — 각 파일의 `key: "status"` 컬럼 바로 뒤에(행 변수명은 에픽 `e`, 프로젝트 `p`, 스프린트 `s`)

```tsx
  {
    key: "progress",
    label: "진행률",
    headClassName: "w-32",
    // 하위 태스크 완료/전체(읽기전용 롤업). 계산값이라 정렬하지 않는다.
    cell: (e) => (
      <TableCell>
        <TaskProgressCell progress={e.progress} />
      </TableCell>
    ),
  },
```

각 파일 상단 컬럼 목록 주석에 `[진행률]` 을 상태 뒤에 넣는다.

- [ ] **Step 4: 타입 검사** — `npx tsc --noEmit` 종료코드 0. 호출부(목록 3·상세 2) 가 progress 를 안 주면 여기서 실패한다.

- [ ] **Step 5: Commit**

```bash
git add src/components/tables/epic-columns.tsx src/components/tables/project-columns.tsx src/components/tables/sprint-columns.tsx
git commit -m "feat(progress): 에픽·프로젝트·스프린트 표에 진행률 컬럼 (BACKEND-160)"
```

---

### Task 5: 상세 요약

**Files:**
- Modify: `src/app/(app)/epics/[id]/page.tsx`, `src/app/(app)/projects/[id]/page.tsx`, `src/app/(app)/sprints/[id]/page.tsx`

- [ ] **Step 1: import** — 세 파일에 `import { TaskProgressSummary } from "@/components/detail/task-progress";`

- [ ] **Step 2: 렌더** — 하위 목록 헤더 div(`mb-3 flex items-center justify-between`) 닫는 태그 바로 뒤, `<Card className="mb-6 overflow-hidden py-0">` 앞에

```tsx
        <TaskProgressSummary progress={epic.progress} />
```

(프로젝트는 `project.progress`, 스프린트는 `sprint.progress`)

- [ ] **Step 3: 타입 검사·lint** — `npx tsc --noEmit && npx eslint src` 종료코드 0

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/epics/[id]/page.tsx" "src/app/(app)/projects/[id]/page.tsx" "src/app/(app)/sprints/[id]/page.tsx"
git commit -m "feat(progress): 에픽·프로젝트·스프린트 상세에 진행 요약 (BACKEND-160)"
```

---

### Task 6: 집계 SQL 런타임 검증(임시 DB, 커밋 안 함)

로컬에 DB 가 없어 raw SQL 은 tsc 로 못 잡는다. 버리는 Postgres 로 실제 실행한다.

- [ ] **Step 1: DB 기동·마이그레이션**

```bash
docker run -d --rm --name sprint-progress-pg -e POSTGRES_PASSWORD=pg -p 55432:5432 postgres:16
DATABASE_URL=postgresql://postgres:pg@localhost:55432/postgres npx prisma migrate deploy
```

- [ ] **Step 2: 임시 테스트** `src/server/zz-rollup.test.ts` — `DATABASE_URL` 을 위 값으로 두고 prisma 로 Team 1·Sprint 1·Project 2(둘 다 스프린트 소속)·Epic 3(프로젝트 A 에 2개, B 에 1개)·Task(에픽별 상태 섞어서, estimatedMd 포함) 생성 후 `getSprints`·`getSprint`·`getProjects`·`getProject`·`getEpics`·`getEpic` 의 `progress`·`estimatedMd` 가 손으로 센 값과 같음을 단언. 태스크 없는 에픽·프로젝트는 `{TODO:0,IN_PROGRESS:0,DONE:0}`.

Run: `DATABASE_URL=postgresql://postgres:pg@localhost:55432/postgres npx vitest run src/server/zz-rollup.test.ts`
Expected: PASS

- [ ] **Step 3: 정리** — 테스트 파일 삭제, `docker stop sprint-progress-pg`

---

### Task 7: 문서

- [ ] **Step 1: `docs/design-system.md`**
  - 상세 화면 다이어그램의 `[하위 목록]` → `[하위 목록: 헤더 · TaskProgressSummary · 표]`
  - 상세 화면 bullet 추가: "하위 목록 헤더와 표 사이에 `detail/task-progress.tsx` 의 `TaskProgressSummary`(최하위 태스크까지 롤업한 완료·진행 중·할 일). 에픽·프로젝트·스프린트 공통, 태스크는 하위 목록이 없어 제외"
  - 목록 화면 "정렬 가능 필드는 DB 컬럼만" bullet 의 제외 목록에 진행률(하위 롤업 계산값) 추가
- [ ] **Step 2: `docs/work-log.md`** 최근 세션 요약 표 맨 위에 2026-09-30 행(무엇을·왜, `DONE`\*)
- [ ] **Step 3: `docs/README.md`** 인덱스에 오라클 `oracle/task-progress-rollup.md` 추가(기존 오라클 항목 형식을 따름)
- [ ] **Step 4: Commit**

```bash
git add docs/design-system.md docs/work-log.md docs/README.md
git commit -m "docs: 진행률 롤업 규격·작업 이력 (BACKEND-160)"
```

---

### Task 8: 오라클 auto 항목 전체 실행

- [ ] `npx tsc --noEmit` / `npx eslint src` / `npx vitest run`(N > 244) / `npx next build` / `git diff main...HEAD --stat -- prisma/` 빈 출력 / `git diff --stat main...HEAD | grep -c " Bin "` = 0
- [ ] O-A-2, O-B-1, O-B-2, O-C-1 의 grep 판정
- [ ] 결과를 PR 본문에 기록. manual 항목은 배포 후 확인 대상으로 PR 에 명시
