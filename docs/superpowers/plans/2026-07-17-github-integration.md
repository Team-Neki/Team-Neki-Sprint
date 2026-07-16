# GitHub 연동 (Task -> Branch -> PR 양방향) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 태스크에서 GitHub 브랜치를 생성하고, webhook으로 PR/브랜치 상태를 태스크에 역동기화한다(PR open -> IN_PROGRESS, merge -> DONE).

**Architecture:** 순수 로직(브랜치명 빌드, 키 파싱, 서명 검증, 상태 매핑)을 `src/lib/github/`에 테스트 가능한 함수로 분리한다. GitHub 호출은 새 npm 의존성 없이 `fetch` + Node `crypto`로 처리한다(App JWT는 RS256 서명, installation token 교환, webhook은 HMAC-SHA256 검증). 아웃바운드(브랜치 생성)는 서버 액션, 인바운드(역동기화)는 `/api/github/webhook` 라우트 + 얇은 핸들러. UI는 태스크 상세 사이드바 패널.

**Tech Stack:** Next.js(App Router, 서버 액션), Prisma(PostgreSQL), NextAuth v5, zod, Vitest, `fetch` + `node:crypto`(신규 npm 의존성 없음).

**Spec:** `docs/superpowers/specs/2026-07-17-github-integration-design.md`

---

## 작업 환경 주의 (매 명령 필독)

- 모든 명령은 **워크트리**에서 실행한다: `/Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration` (브랜치 `feat/github-integration`).
- Bash 셸의 기본 cwd가 주 리포로 리셋되므로, 각 명령 앞에 `cd`를 붙이거나 절대경로/`git -C`를 쓴다.
- 검증은 워크트리에서 `npm run test`(vitest), `npx tsc --noEmit`, `npm run lint`로 한다. `next build`/`dev`는 워크트리에서 돌리지 않는다(Turbopack이 symlink node_modules 거부).
- **DB 필요 단계**: `prisma migrate dev`는 `DATABASE_URL`이 있는 환경에서 실행한다. 워크트리에 `.env`가 없으면 마이그레이션 생성은 병합 후 main(DB 접근 가능)에서 하거나, dev DB를 가리키는 `.env`를 워크트리에 임시로 둔다. 스키마 편집 후 타입 확인용 `npx prisma generate`는 DB 없이 동작한다.
- 스키마 변경 후에는 항상 `npx prisma generate` + (해당 환경에서) dev 서버 재시작(gotchas 필독 항목).

---

## File Structure

**신규 (순수 로직 + 테스트):**
- `src/lib/github/branch-name.ts` — `slugify`, `buildBranchName`
- `src/lib/github/branch-name.test.ts`
- `src/lib/github/parse-key.ts` — `parseTaskKeyFromRef`
- `src/lib/github/parse-key.test.ts`
- `src/lib/github/pr-status.ts` — `prEventToStatus`
- `src/lib/github/pr-status.test.ts`
- `src/lib/github/signature.ts` — `verifyWebhookSignature`
- `src/lib/github/signature.test.ts`

**신규 (GitHub 호출 / 서버):**
- `src/lib/github/app.ts` — App JWT + installation token + `githubFetch`
- `src/server/github/installation.ts` — 설치 조회 헬퍼
- `src/server/github/handle-webhook.ts` — webhook 이벤트 처리(DB upsert + 상태 전이)
- `src/server/actions/github.ts` — `listInstallationRepos`, `createBranchForTask`
- `src/app/api/github/webhook/route.ts` — POST 수신
- `src/app/api/github/setup/route.ts` — GET 설치 콜백

**신규 (UI):**
- `src/components/detail/task-github.tsx` — 패널 + 생성 폼

**수정:**
- `prisma/schema.prisma` — `GithubInstallation`, `GithubBranchLink` 모델 + `Task.githubLinks` 역관계
- `src/lib/validators.ts` — `createBranchSchema`
- `src/server/queries.ts` — `getTaskGithubLinks`
- `src/app/(app)/tasks/[id]/page.tsx` — 링크 조회 + 패널 렌더
- `.env.example` — GitHub App env
- `docs/work-log.md` — 변경 이력

---

## Task 1: Prisma 스키마 (모델 2개 + 관계)

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: `Task` 모델에 역관계 추가**

`prisma/schema.prisma`의 `model Task { ... }` 안, `blockedBy TaskDependency[] @relation("BlockedTask")` 줄 아래에 추가:

```prisma
  githubLinks GithubBranchLink[]
```

- [ ] **Step 2: 파일 끝에 신규 모델 2개 추가**

`prisma/schema.prisma` 맨 아래에 추가:

```prisma
model GithubInstallation {
  id             String   @id @default(cuid())
  installationId Int      @unique // GitHub 설치 ID
  accountLogin   String            // org/user 로그인명(빈 값 허용, webhook 로 보강)
  createdAt      DateTime @default(now())
}

model GithubBranchLink {
  id           String   @id @default(cuid())
  taskId       String
  task         Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  repoFullName String            // "owner/repo"
  branchName   String
  branchUrl    String
  prNumber     Int?
  prState      String?           // OPEN | CLOSED | MERGED
  prUrl        String?
  prTitle      String?
  createdById  String?           // 앱으로 만든 사람(자동연결은 null)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([repoFullName, branchName]) // webhook 재전송 멱등 upsert 키
  @@index([taskId])
}
```

- [ ] **Step 3: Prisma client 생성(타입 확인)**

Run: `cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration && npx prisma generate`
Expected: `Generated Prisma Client` 성공. 이후 `prisma.githubBranchLink` / `prisma.githubInstallation` 타입 사용 가능.

- [ ] **Step 4: 마이그레이션 생성 (DB 접근 가능한 환경에서)**

Run: `npx prisma migrate dev --name add_github_integration`
Expected: `prisma/migrations/*_add_github_integration/migration.sql` 생성.
주의: `DATABASE_URL` 필요. 워크트리에 DB env가 없으면 이 스텝은 병합 후 main에서 수행하고, 여기서는 Step 3(generate)로만 타입을 맞춘다. 마이그레이션 적용 환경에서는 dev 서버 재시작 필수.

- [ ] **Step 5: Commit**

```bash
cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(github): GithubInstallation/GithubBranchLink 스키마 추가"
```

---

## Task 2: 브랜치명 빌드 (순수 로직, TDD)

**Files:**
- Create: `src/lib/github/branch-name.ts`
- Test: `src/lib/github/branch-name.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/github/branch-name.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slugify, buildBranchName } from "@/lib/github/branch-name";

describe("slugify", () => {
  it("영문 제목을 소문자 하이픈 slug 로", () => {
    expect(slugify("Login Button")).toBe("login-button");
  });
  it("특수문자/연속 공백을 하이픈 하나로 축약하고 양끝 하이픈 제거", () => {
    expect(slugify("  Fix: the (broken) thing!! ")).toBe("fix-the-broken-thing");
  });
  it("비ASCII(한글)만이면 빈 문자열", () => {
    expect(slugify("로그인 버튼")).toBe("");
  });
  it("40자로 자른다", () => {
    expect(slugify("a".repeat(60)).length).toBe(40);
  });
});

describe("buildBranchName", () => {
  it("prefix/KEY-slug 형태", () => {
    expect(buildBranchName("feature", "DESIGN-12", "Login Button")).toBe(
      "feature/DESIGN-12-login-button",
    );
  });
  it("slug 가 비면 prefix/KEY 로 폴백", () => {
    expect(buildBranchName("fix", "API-3", "로그인")).toBe("fix/API-3");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration && npx vitest run src/lib/github/branch-name.test.ts`
Expected: FAIL — `Cannot find module '@/lib/github/branch-name'`.

- [ ] **Step 3: 구현**

`src/lib/github/branch-name.ts`:

```ts
export type BranchPrefix = "feature" | "fix" | "chore";

/** 제목 -> 브랜치 slug: 소문자화, 영숫자만 남기고 하이픈으로, 양끝 하이픈 제거, 최대 40자. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** `prefix/KEY-slug`. slug 가 비면 `prefix/KEY`. */
export function buildBranchName(
  prefix: BranchPrefix,
  issueKey: string,
  title: string,
): string {
  const slug = slugify(title);
  return slug ? `${prefix}/${issueKey}-${slug}` : `${prefix}/${issueKey}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/github/branch-name.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration
git add src/lib/github/branch-name.ts src/lib/github/branch-name.test.ts
git commit -m "feat(github): buildBranchName/slugify 순수 로직"
```

---

## Task 3: 태스크 키 파싱 (순수 로직, TDD)

**Files:**
- Create: `src/lib/github/parse-key.ts`
- Test: `src/lib/github/parse-key.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/github/parse-key.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseTaskKeyFromRef } from "@/lib/github/parse-key";

describe("parseTaskKeyFromRef", () => {
  const keys = ["DESIGN", "API"];
  it("브랜치명에서 KEY-NUMBER 추출", () => {
    expect(parseTaskKeyFromRef("feature/DESIGN-12-login", keys)).toEqual({
      teamKey: "DESIGN",
      number: 12,
    });
  });
  it("대소문자 무시하고 팀 키 대조, 반환은 대문자", () => {
    expect(parseTaskKeyFromRef("fix/design-7", keys)).toEqual({
      teamKey: "DESIGN",
      number: 7,
    });
  });
  it("알 수 없는 접두어는 무시하고 다음 매칭", () => {
    expect(parseTaskKeyFromRef("feature/FOO-1-and-API-9", keys)).toEqual({
      teamKey: "API",
      number: 9,
    });
  });
  it("매칭 없으면 null", () => {
    expect(parseTaskKeyFromRef("hotfix/urgent", keys)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration && npx vitest run src/lib/github/parse-key.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`src/lib/github/parse-key.ts`:

```ts
export type ParsedKey = { teamKey: string; number: number };

/**
 * 임의 문자열(브랜치명/PR제목)에서 태스크 키(TEAMKEY-NUMBER)를 찾는다.
 * teamKeys 는 워크스페이스의 모든 Team.key. 대소문자 무시 대조, 첫 매칭 반환(대문자 정규화).
 * 없으면 null.
 */
export function parseTaskKeyFromRef(
  ref: string,
  teamKeys: string[],
): ParsedKey | null {
  const known = new Set(teamKeys.map((k) => k.toUpperCase()));
  for (const m of ref.matchAll(/([A-Za-z][A-Za-z0-9]*)-(\d+)/g)) {
    const teamKey = m[1].toUpperCase();
    if (known.has(teamKey)) {
      return { teamKey, number: Number(m[2]) };
    }
  }
  return null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/github/parse-key.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration
git add src/lib/github/parse-key.ts src/lib/github/parse-key.test.ts
git commit -m "feat(github): parseTaskKeyFromRef 순수 로직"
```

---

## Task 4: PR 이벤트 -> 상태 매핑 (순수 로직, TDD)

**Files:**
- Create: `src/lib/github/pr-status.ts`
- Test: `src/lib/github/pr-status.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/github/pr-status.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prEventToStatus } from "@/lib/github/pr-status";

describe("prEventToStatus", () => {
  it("opened -> OPEN, IN_PROGRESS", () => {
    expect(prEventToStatus("opened", false)).toEqual({
      prState: "OPEN",
      taskStatus: "IN_PROGRESS",
    });
  });
  it("reopened/ready_for_review 도 OPEN, IN_PROGRESS", () => {
    expect(prEventToStatus("reopened", false)?.taskStatus).toBe("IN_PROGRESS");
    expect(prEventToStatus("ready_for_review", false)?.prState).toBe("OPEN");
  });
  it("closed + merged -> MERGED, DONE", () => {
    expect(prEventToStatus("closed", true)).toEqual({
      prState: "MERGED",
      taskStatus: "DONE",
    });
  });
  it("closed + !merged -> CLOSED, 상태 변경 없음", () => {
    expect(prEventToStatus("closed", false)).toEqual({
      prState: "CLOSED",
      taskStatus: null,
    });
  });
  it("알 수 없는 action 은 null", () => {
    expect(prEventToStatus("synchronize", false)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration && npx vitest run src/lib/github/pr-status.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`src/lib/github/pr-status.ts`:

```ts
import type { Status } from "@prisma/client";

export type PrOutcome = {
  prState: "OPEN" | "CLOSED" | "MERGED";
  taskStatus: Status | null;
};

/**
 * pull_request webhook action + merged 여부 -> PR 표시 상태 & 태스크 자동 전이 대상.
 * opened/reopened/ready_for_review -> OPEN + IN_PROGRESS.
 * closed & merged -> MERGED + DONE. closed & !merged -> CLOSED + 변경 없음.
 * 그 외 action -> null(무시).
 */
export function prEventToStatus(
  action: string,
  merged: boolean,
): PrOutcome | null {
  switch (action) {
    case "opened":
    case "reopened":
    case "ready_for_review":
      return { prState: "OPEN", taskStatus: "IN_PROGRESS" };
    case "closed":
      return merged
        ? { prState: "MERGED", taskStatus: "DONE" }
        : { prState: "CLOSED", taskStatus: null };
    default:
      return null;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/github/pr-status.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration
git add src/lib/github/pr-status.ts src/lib/github/pr-status.test.ts
git commit -m "feat(github): prEventToStatus 순수 로직"
```

---

## Task 5: webhook 서명 검증 (순수 로직, TDD)

**Files:**
- Create: `src/lib/github/signature.ts`
- Test: `src/lib/github/signature.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/github/signature.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "@/lib/github/signature";

function sign(body: string, secret: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  const secret = "s3cr3t";
  const body = JSON.stringify({ hello: "world" });

  it("올바른 서명은 true", () => {
    expect(verifyWebhookSignature(body, sign(body, secret), secret)).toBe(true);
  });
  it("틀린 서명은 false", () => {
    expect(verifyWebhookSignature(body, sign(body, "wrong"), secret)).toBe(false);
  });
  it("헤더 없음은 false", () => {
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
  });
  it("본문 변조는 false", () => {
    expect(
      verifyWebhookSignature(body + "x", sign(body, secret), secret),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration && npx vitest run src/lib/github/signature.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`src/lib/github/signature.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * GitHub webhook 서명 검증. signatureHeader 는 "sha256=..." 형식(X-Hub-Signature-256).
 * rawBody 는 파싱 전 요청 원문. 상수시간 비교.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/github/signature.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration
git add src/lib/github/signature.ts src/lib/github/signature.test.ts
git commit -m "feat(github): verifyWebhookSignature 순수 로직"
```

---

## Task 6: GitHub App 인증 클라이언트 (fetch + crypto)

**Files:**
- Create: `src/lib/github/app.ts`

런타임(App JWT/네트워크) 코드라 유닛 테스트 대신 `tsc --noEmit`+`eslint`로 검증한다.

- [ ] **Step 1: 구현**

`src/lib/github/app.ts`:

```ts
import "server-only";
import { createSign } from "node:crypto";

const API = "https://api.github.com";

/** App 인증용 단기 JWT(RS256). 만료 <=10분. */
function appJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  const pkey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !pkey) {
    throw new Error("GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY 미설정");
  }
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const data = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId,
  })}`;
  const sig = createSign("RSA-SHA256")
    .update(data)
    .sign(pkey.replace(/\\n/g, "\n"), "base64url");
  return `${data}.${sig}`;
}

/** installation access token 발급(1시간 만료). */
async function installationToken(installationId: number): Promise<string> {
  const res = await fetch(
    `${API}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!res.ok) {
    throw new Error(`installation token 발급 실패: ${res.status}`);
  }
  const json = (await res.json()) as { token: string };
  return json.token;
}

/**
 * installation 토큰으로 GitHub REST 호출. path 는 "/repos/..." 형태.
 * MVP: 호출마다 토큰 발급(현 규모에서 충분). 필요 시 만료 캐시로 최적화.
 */
export async function githubFetch(
  installationId: number,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await installationToken(installationId);
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
```

- [ ] **Step 2: 타입/린트 확인**

Run: `cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration && npx tsc --noEmit && npx eslint src/lib/github/app.ts`
Expected: 오류 없음. (`server-only` 는 기존 의존성. 확인: `grep -r "server-only" src | head` — 이미 사용 중이면 그대로, 없으면 import 줄 삭제.)

- [ ] **Step 3: Commit**

```bash
cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration
git add src/lib/github/app.ts
git commit -m "feat(github): App JWT + installation token fetch 클라이언트"
```

---

## Task 7: 설치 조회 헬퍼 + setup 콜백 라우트

**Files:**
- Create: `src/server/github/installation.ts`
- Create: `src/app/api/github/setup/route.ts`

- [ ] **Step 1: 설치 조회 헬퍼 구현**

`src/server/github/installation.ts`:

```ts
import { prisma } from "@/lib/prisma";

/** 워크스페이스의 활성 설치 하나(단일 워크스페이스 전제). 없으면 null. */
export async function getActiveInstallation() {
  return prisma.githubInstallation.findFirst({
    orderBy: { createdAt: "desc" },
  });
}
```

- [ ] **Step 2: setup 콜백 라우트 구현**

`src/app/api/github/setup/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GitHub App 설치 후 리다이렉트되는 콜백.
 * ?installation_id=..&setup_action=install|update 로 도착. 설치를 저장하고 앱으로 복귀.
 * accountLogin 은 installation webhook 에서 보강되므로 여기선 빈 값 허용.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const installationId = Number(url.searchParams.get("installation_id"));
  const action = url.searchParams.get("setup_action");
  if (!installationId || Number.isNaN(installationId)) {
    return NextResponse.json({ error: "installation_id 누락" }, { status: 400 });
  }
  if (action === "install" || action === "update") {
    await prisma.githubInstallation.upsert({
      where: { installationId },
      create: { installationId, accountLogin: "" },
      update: {},
    });
  }
  return NextResponse.redirect(new URL("/?github=connected", url.origin));
}
```

- [ ] **Step 3: 타입/린트 확인**

Run: `cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration && npx tsc --noEmit && npx eslint src/server/github/installation.ts "src/app/api/github/setup/route.ts"`
Expected: 오류 없음.

- [ ] **Step 4: Commit**

```bash
cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration
git add src/server/github/installation.ts "src/app/api/github/setup"
git commit -m "feat(github): 설치 조회 헬퍼 + setup 콜백 라우트"
```

---

## Task 8: 브랜치 생성 서버 액션 + 레포 목록 + validator

**Files:**
- Modify: `src/lib/validators.ts`
- Create: `src/server/actions/github.ts`

- [ ] **Step 1: validator 추가**

`src/lib/validators.ts` 맨 아래에 추가 (파일 상단에 `import { z } from "zod";` 가 이미 있는지 확인; 없으면 추가):

```ts
export const createBranchSchema = z.object({
  taskId: z.string(),
  repoFullName: z.string().min(1),
  prefix: z.enum(["feature", "fix", "chore"]),
  branchName: z.string().min(1),
  base: z.string().nullish(),
});
```

- [ ] **Step 2: 서버 액션 구현**

`src/server/actions/github.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { createBranchSchema } from "@/lib/validators";
import { getActiveInstallation } from "@/server/github/installation";
import { githubFetch } from "@/lib/github/app";

export type RepoOption = { fullName: string; defaultBranch: string };

/** 설치에 접근 가능한 레포 목록(생성 폼 select 용). */
export async function listInstallationRepos(): Promise<RepoOption[]> {
  await requireUser();
  const inst = await getActiveInstallation();
  if (!inst) return [];
  const res = await githubFetch(
    inst.installationId,
    "/installation/repositories?per_page=100",
  );
  if (!res.ok) throw new Error(`레포 목록 조회 실패: ${res.status}`);
  const json = (await res.json()) as {
    repositories: { full_name: string; default_branch: string }[];
  };
  return json.repositories.map((r) => ({
    fullName: r.full_name,
    defaultBranch: r.default_branch,
  }));
}

/** 태스크에서 GitHub 브랜치 생성 후 링크 저장. */
export async function createBranchForTask(input: unknown) {
  const user = await requireUser();
  const data = createBranchSchema.parse(input);
  const inst = await getActiveInstallation();
  if (!inst) throw new Error("GitHub App 설치가 없습니다");

  const [owner, repo] = data.repoFullName.split("/");
  if (!owner || !repo) throw new Error("레포 형식이 올바르지 않습니다");

  // base 미지정 시 레포 default branch.
  let base = data.base ?? "";
  if (!base) {
    const repoRes = await githubFetch(
      inst.installationId,
      `/repos/${owner}/${repo}`,
    );
    if (!repoRes.ok) throw new Error(`레포 조회 실패: ${repoRes.status}`);
    base = ((await repoRes.json()) as { default_branch: string }).default_branch;
  }

  // base SHA.
  const refRes = await githubFetch(
    inst.installationId,
    `/repos/${owner}/${repo}/git/ref/heads/${base}`,
  );
  if (!refRes.ok) {
    throw new Error(`base 브랜치(${base}) 조회 실패: ${refRes.status}`);
  }
  const sha = ((await refRes.json()) as { object: { sha: string } }).object.sha;

  // 브랜치 생성.
  const createRes = await githubFetch(
    inst.installationId,
    `/repos/${owner}/${repo}/git/refs`,
    {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${data.branchName}`, sha }),
    },
  );
  if (createRes.status === 422) {
    throw new Error("같은 이름의 브랜치가 이미 있습니다");
  }
  if (!createRes.ok) throw new Error(`브랜치 생성 실패: ${createRes.status}`);

  const branchUrl = `https://github.com/${data.repoFullName}/tree/${data.branchName}`;
  await prisma.githubBranchLink.upsert({
    where: {
      repoFullName_branchName: {
        repoFullName: data.repoFullName,
        branchName: data.branchName,
      },
    },
    create: {
      taskId: data.taskId,
      repoFullName: data.repoFullName,
      branchName: data.branchName,
      branchUrl,
      createdById: user.id,
    },
    update: { taskId: data.taskId, createdById: user.id },
  });

  revalidatePath(`/tasks/${data.taskId}`);
  return { branchName: data.branchName, branchUrl };
}
```

- [ ] **Step 3: 타입/린트 확인**

Run: `cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration && npx tsc --noEmit && npx eslint src/server/actions/github.ts src/lib/validators.ts`
Expected: 오류 없음. (composite unique 접근자 이름은 `repoFullName_branchName` — Prisma가 `@@unique([repoFullName, branchName])`에서 생성.)

- [ ] **Step 4: Commit**

```bash
cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration
git add src/server/actions/github.ts src/lib/validators.ts
git commit -m "feat(github): 브랜치 생성 서버 액션 + 레포 목록"
```

---

## Task 9: webhook 핸들러 + 라우트

**Files:**
- Create: `src/server/github/handle-webhook.ts`
- Create: `src/app/api/github/webhook/route.ts`

- [ ] **Step 1: 핸들러 구현**

`src/server/github/handle-webhook.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { parseTaskKeyFromRef } from "@/lib/github/parse-key";
import { prEventToStatus } from "@/lib/github/pr-status";

type Account = { login?: string };
type Installation = { id: number; account?: Account };
type Repository = { full_name: string };
type PullRequest = {
  number: number;
  title: string;
  html_url: string;
  merged: boolean;
  head: { ref: string };
};
export type GithubPayload = {
  action?: string;
  ref?: string;
  ref_type?: string;
  repository?: Repository;
  pull_request?: PullRequest;
  installation?: Installation;
};

async function allTeamKeys(): Promise<string[]> {
  const teams = await prisma.team.findMany({ select: { key: true } });
  return teams.map((t) => t.key);
}

async function findTaskId(
  teamKey: string,
  number: number,
): Promise<string | null> {
  const team = await prisma.team.findUnique({
    where: { key: teamKey },
    select: { id: true },
  });
  if (!team) return null;
  const task = await prisma.task.findUnique({
    where: { teamId_number: { teamId: team.id, number } },
    select: { id: true },
  });
  return task?.id ?? null;
}

/**
 * GitHub webhook 이벤트 처리. 모든 쓰기는 upsert(재전송 멱등).
 * installation: 설치 저장/삭제.
 * create(branch): 이름에 유효 키 있으면 자동연결(상태 변경 없음).
 * pull_request: 링크 upsert + PR 상태 + 태스크 자동 전이(open->IN_PROGRESS, merge->DONE).
 */
export async function handleGithubEvent(
  event: string,
  payload: GithubPayload,
): Promise<void> {
  if (event === "installation") {
    const inst = payload.installation;
    if (!inst) return;
    if (payload.action === "deleted") {
      await prisma.githubInstallation.deleteMany({
        where: { installationId: inst.id },
      });
    } else {
      await prisma.githubInstallation.upsert({
        where: { installationId: inst.id },
        create: { installationId: inst.id, accountLogin: inst.account?.login ?? "" },
        update: { accountLogin: inst.account?.login ?? "" },
      });
    }
    return;
  }

  if (event === "create" && payload.ref_type === "branch") {
    const repoFullName = payload.repository?.full_name;
    const branchName = payload.ref;
    if (!repoFullName || !branchName) return;
    const parsed = parseTaskKeyFromRef(branchName, await allTeamKeys());
    if (!parsed) return;
    const taskId = await findTaskId(parsed.teamKey, parsed.number);
    if (!taskId) return;
    const branchUrl = `https://github.com/${repoFullName}/tree/${branchName}`;
    await prisma.githubBranchLink.upsert({
      where: { repoFullName_branchName: { repoFullName, branchName } },
      create: { taskId, repoFullName, branchName, branchUrl },
      update: {},
    });
    return;
  }

  if (event === "pull_request") {
    const pr = payload.pull_request;
    const repoFullName = payload.repository?.full_name;
    if (!pr || !repoFullName) return;
    const branchName = pr.head.ref;
    const keys = await allTeamKeys();
    const parsed =
      parseTaskKeyFromRef(branchName, keys) ??
      parseTaskKeyFromRef(pr.title ?? "", keys);
    if (!parsed) return;
    const taskId = await findTaskId(parsed.teamKey, parsed.number);
    if (!taskId) return;

    // 제목만 바뀐 경우: prTitle 만 갱신.
    if (payload.action === "edited") {
      await prisma.githubBranchLink.updateMany({
        where: { repoFullName, branchName },
        data: { prTitle: pr.title },
      });
      return;
    }

    const outcome = prEventToStatus(payload.action ?? "", Boolean(pr.merged));
    if (!outcome) return;

    const branchUrl = `https://github.com/${repoFullName}/tree/${branchName}`;
    await prisma.githubBranchLink.upsert({
      where: { repoFullName_branchName: { repoFullName, branchName } },
      create: {
        taskId,
        repoFullName,
        branchName,
        branchUrl,
        prNumber: pr.number,
        prState: outcome.prState,
        prUrl: pr.html_url,
        prTitle: pr.title,
      },
      update: {
        prNumber: pr.number,
        prState: outcome.prState,
        prUrl: pr.html_url,
        prTitle: pr.title,
      },
    });

    if (outcome.taskStatus) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: outcome.taskStatus },
      });
    }
  }
}
```

- [ ] **Step 2: 라우트 구현**

`src/app/api/github/webhook/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/github/signature";
import {
  handleGithubEvent,
  type GithubPayload,
} from "@/server/github/handle-webhook";

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "GITHUB_WEBHOOK_SECRET 미설정" },
      { status: 500 },
    );
  }

  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(raw, sig, secret)) {
    return NextResponse.json({ error: "서명 불일치" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event") ?? "";
  try {
    await handleGithubEvent(event, JSON.parse(raw) as GithubPayload);
  } catch (e) {
    console.error("[github webhook]", e);
    // 멱등 upsert 라 재전송이 무의미 → 200 으로 확인 처리, 심각 오류만 로깅.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: 타입/린트 확인**

Run: `cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration && npx tsc --noEmit && npx eslint src/server/github/handle-webhook.ts "src/app/api/github/webhook/route.ts"`
Expected: 오류 없음. (`teamId_number` 는 Task `@@unique([teamId, number])` 접근자.)

- [ ] **Step 4: Commit**

```bash
cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration
git add src/server/github/handle-webhook.ts "src/app/api/github/webhook"
git commit -m "feat(github): webhook 핸들러 + 라우트(서명 검증, 상태 역동기화)"
```

---

## Task 10: UI 패널 (task-github.tsx)

**Files:**
- Create: `src/components/detail/task-github.tsx`

- [ ] **Step 1: 컴포넌트 구현**

`src/components/detail/task-github.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { GitBranch, Plus } from "lucide-react";
import { OptionSelect } from "@/components/selects/option-select";
import { buildBranchName, type BranchPrefix } from "@/lib/github/branch-name";
import {
  listInstallationRepos,
  createBranchForTask,
  type RepoOption,
} from "@/server/actions/github";

export type GithubLink = {
  id: string;
  repoFullName: string;
  branchName: string;
  branchUrl: string;
  prNumber: number | null;
  prState: string | null;
  prUrl: string | null;
};

const PREFIXES: BranchPrefix[] = ["feature", "fix", "chore"];

// PR 상태 배지: 기존 시맨틱 토큰만 사용(새 색 도입 금지, DESIGN.md).
const PR_BADGE: Record<string, string> = {
  OPEN: "bg-primary/10 text-primary",
  MERGED: "bg-primary/10 text-primary",
  CLOSED: "bg-muted text-muted-foreground",
};

export function TaskGithub({
  taskId,
  issueKey,
  title,
  links,
}: {
  taskId: string;
  issueKey: string;
  title: string;
  links: GithubLink[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<RepoOption[] | null>(null);
  const [repo, setRepo] = useState<string>();
  const [prefix, setPrefix] = useState<BranchPrefix>("feature");
  const [branchName, setBranchName] = useState(
    buildBranchName("feature", issueKey, title),
  );
  const [pending, start] = useTransition();

  async function openForm() {
    setOpen(true);
    if (repos) return;
    try {
      const list = await listInstallationRepos();
      setRepos(list);
      if (list[0]) setRepo(list[0].fullName);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "레포 목록을 불러오지 못했습니다");
    }
  }

  function onPrefixChange(p: BranchPrefix) {
    setPrefix(p);
    setBranchName(buildBranchName(p, issueKey, title));
  }

  function submit() {
    if (!repo) {
      toast.error("레포를 선택하세요");
      return;
    }
    start(async () => {
      try {
        await createBranchForTask({
          taskId,
          repoFullName: repo,
          prefix,
          branchName,
          base: null,
        });
        toast.success("브랜치를 생성했습니다");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "브랜치 생성에 실패했습니다");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">GitHub</h3>
        <button
          type="button"
          onClick={openForm}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
        >
          <Plus className="size-3.5" /> 브랜치 생성
        </button>
      </div>

      {links.length === 0 ? (
        <p className="text-muted-foreground text-sm">연결된 브랜치가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {links.map((l) => (
            <li
              key={l.id}
              className="border-border bg-card flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <GitBranch className="text-muted-foreground size-4 shrink-0" />
              <Link
                href={l.branchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate font-mono text-xs hover:underline"
              >
                {l.branchName}
              </Link>
              {l.prNumber !== null && l.prUrl && (
                <Link
                  href={l.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                    PR_BADGE[l.prState ?? "OPEN"] ?? ""
                  }`}
                >
                  #{l.prNumber} {l.prState}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="border-border flex flex-col gap-2 rounded-md border p-3">
          <span className="text-muted-foreground text-xs">레포</span>
          <OptionSelect
            value={repo}
            onValueChange={setRepo}
            options={repos ?? []}
            getValue={(r) => r.fullName}
            renderOption={(r) => (
              <span className="font-mono text-xs">{r.fullName}</span>
            )}
            placeholder={repos ? "레포 선택" : "불러오는 중…"}
          />
          <span className="text-muted-foreground text-xs">유형</span>
          <OptionSelect
            value={prefix}
            onValueChange={(v) => onPrefixChange(v as BranchPrefix)}
            options={PREFIXES}
            getValue={(p) => p}
            renderOption={(p) => <span>{p}</span>}
          />
          <span className="text-muted-foreground text-xs">브랜치명</span>
          <input
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            className="border-border bg-background rounded-md border px-2 py-1 font-mono text-xs"
          />
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground text-xs"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs disabled:opacity-50"
            >
              생성
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입/린트 확인**

Run: `cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration && npx tsc --noEmit && npx eslint src/components/detail/task-github.tsx`
Expected: 오류 없음.

- [ ] **Step 3: Commit**

```bash
cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration
git add src/components/detail/task-github.tsx
git commit -m "feat(github): 태스크 상세 GitHub 패널(브랜치 생성 폼 + 링크 목록)"
```

---

## Task 11: 상세 페이지 연결 (query + 렌더)

**Files:**
- Modify: `src/server/queries.ts`
- Modify: `src/app/(app)/tasks/[id]/page.tsx`

- [ ] **Step 1: query 추가**

`src/server/queries.ts` 맨 아래에 추가 (파일 상단 `import { prisma } from "@/lib/prisma";` 확인):

```ts
export async function getTaskGithubLinks(taskId: string) {
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
```

- [ ] **Step 2: 페이지 import 추가**

`src/app/(app)/tasks/[id]/page.tsx` 상단 import 블록에 추가:

```ts
import { TaskGithub } from "@/components/detail/task-github";
```

그리고 기존 `import { ... } from "@/server/queries";` 목록에 `getTaskGithubLinks` 를 추가한다(예: `getLabelOptions,` 다음 줄에 `  getTaskGithubLinks,`).

- [ ] **Step 3: 데이터 조회에 링크 추가**

같은 파일의 `const [task, epics, members, activities, labelOptions] = await Promise.all([ ... ]);` 를 아래로 교체:

```ts
  const [task, epics, members, activities, labelOptions, githubLinks] =
    await Promise.all([
      getTask(id),
      getEpicOptions(),
      getMembers(),
      getEntityActivity("task", id),
      getLabelOptions(),
      getTaskGithubLinks(id),
    ]);
```

- [ ] **Step 4: 패널 렌더**

같은 파일에서 `<TaskDependencies ... />` 를 렌더하는 위치를 찾아(예: `grep -n "TaskDependencies" src/app/(app)/tasks/[id]/page.tsx`) 그 바로 아래에 추가한다. `task.team?.key` 와 `task.number` 로 키를 만든다:

```tsx
      <TaskGithub
        taskId={task.id}
        issueKey={formatIssueKey(task.team?.key ?? null, task.number)}
        title={task.title}
        links={githubLinks}
      />
```

주의: `getTask` 결과에 `team.key`, `number`, `title` 이 포함되는지 확인한다(`grep -n "team" src/server/queries.ts` 로 `getTask` select 확인). 없으면 `getTask` 의 select 에 `team: { select: { key: true } }`, `number: true`, `title: true` 를 추가한다.

- [ ] **Step 5: 타입/린트 확인**

Run: `cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration && npx tsc --noEmit && npx eslint "src/app/(app)/tasks/[id]/page.tsx" src/server/queries.ts`
Expected: 오류 없음.

- [ ] **Step 6: Commit**

```bash
cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration
git add src/server/queries.ts "src/app/(app)/tasks/[id]/page.tsx"
git commit -m "feat(github): 태스크 상세에 GitHub 패널 연결"
```

---

## Task 12: env 예시 + 문서 + 전체 검증

**Files:**
- Modify: `.env.example`
- Modify: `docs/work-log.md`

- [ ] **Step 1: `.env.example` 에 GitHub App 설정 추가**

`.env.example` 맨 아래에 추가:

```bash
# ---- GitHub App 연동 ----
# github.com/settings/apps 에서 App 생성 후 값 입력.
# 권한: Contents Read/Write, Pull requests Read, Metadata Read.
# 구독 이벤트: create, pull_request, installation.
# webhook URL: https://sprint.suitestudy.com:4641/api/github/webhook
# setup URL:   https://sprint.suitestudy.com:4641/api/github/setup
GITHUB_APP_ID=""
# PEM 개인키. 개행은 \n 로 이스케이프해 한 줄로 넣는다.
GITHUB_APP_PRIVATE_KEY=""
GITHUB_WEBHOOK_SECRET=""
```

- [ ] **Step 2: work-log 갱신**

`docs/work-log.md` 최상단(최신 항목 위치)에 한 항목 추가:

```markdown
## 2026-07-17 GitHub 연동(Task -> Branch -> PR 양방향)

- 태스크 상세에서 GitHub 브랜치 생성(`prefix/KEY-slug`), 레포는 생성 시 선택.
- webhook(`/api/github/webhook`)으로 PR open->IN_PROGRESS, merge->DONE 자동 전이.
  이름 규칙(태스크 키)으로 CLI 생성 브랜치/PR 도 자동 연결.
- 인증: GitHub App installation token. 신규 npm 의존성 없이 fetch + node:crypto.
- 모델: `GithubInstallation`, `GithubBranchLink`. 설계: specs/2026-07-17-github-integration-design.md
```

- [ ] **Step 3: 전체 유닛 테스트 + 타입 + 린트**

Run: `cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration && npm run test && npx tsc --noEmit && npm run lint`
Expected: vitest 전체 PASS(신규 4개 파일 포함), tsc 오류 0, eslint 오류 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/koo/CodeSpace/team-neki/Team-Neki-Sprint-github-integration
git add .env.example docs/work-log.md
git commit -m "docs(github): env 예시 + work-log 갱신"
```

---

## 병합 후 (main에서) 필수 후속

워크트리에서 끝난 뒤 main 병합 시:

1. `npm install` (신규 npm 의존성은 없지만 lockfile 동기화 확인).
2. `npx prisma migrate deploy`(또는 `migrate dev`)로 마이그레이션 적용 + `npx prisma generate`.
3. dev/prod 서버 재시작(스키마 변경 반영).
4. GitHub App 등록(org 관리자): 권한/이벤트/webhook URL/시크릿 설정, prod env 3개 주입.
5. App 설치 후 `/api/github/setup` 콜백으로 설치 저장 확인, "Recent Deliveries"에서 ping 도달 확인(`:4641` 포트 인바운드 열림 여부).

## 수동 검증 시나리오 (통합)

- 태스크 상세 -> "브랜치 생성" -> 레포 선택 -> 생성 -> GitHub에 브랜치 생김 + 패널에 표시.
- 그 브랜치로 PR 오픈 -> 태스크가 IN_PROGRESS + 패널에 PR 배지.
- PR merge -> 태스크 DONE + 배지 MERGED.
- CLI로 `feature/DESIGN-12-x` 브랜치 push -> `create` webhook 으로 자동 연결.

## 로컬 개발 webhook 테스트

GitHub이 localhost에 도달 못 하므로 터널 필요: smee.io 채널을 만들어 App webhook URL로 쓰고
`npx smee -u <channel> -t http://localhost:3000/api/github/webhook` 로 포워딩. 브랜치 생성
(아웃바운드)은 터널 없이 App env만 있으면 동작.
