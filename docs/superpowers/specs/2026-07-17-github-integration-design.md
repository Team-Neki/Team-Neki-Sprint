# GitHub 연동 설계 (Task -> Branch -> PR 양방향)

- 상태: 승인됨 (2026-07-17)
- 브랜치: `feat/github-integration`
- 범위: Tier 1(브랜치 생성) + Tier 2(webhook 역동기화)를 한 번에 구현

## 1. 목표와 배경

Jira의 "Create branch" 연동을 재현한다. 태스크에서 GitHub 브랜치를 생성하고, 이후
브랜치/PR 상태를 태스크에 역동기화한다. Jira와 동일하게 **브랜치/PR 이름에 태스크 키를
규칙으로 심고, webhook으로 키를 파싱해 역동기화**하는 구조다. GitHub 네이티브 issue-branch
링크(`createLinkedBranch`)는 GitHub Issue에만 연결되고 우리 태스크와 무관하므로 사용하지
않는다.

태스크 키는 `{Team.key}-{Task.number}` 형태다(예: `DESIGN-12`). Team이 키 접두어이자 유저
그룹 단위다.

## 2. 결정 요약

| 항목 | 결정 |
|------|------|
| 인증 | GitHub App (org 설치, installation token) |
| 레포 선택 | 브랜치 생성 시 매번 설치된 레포 목록에서 선택 |
| 브랜치명 | `prefix/KEY-slug` (예: `feature/DESIGN-12-login-button`, 생성 시 편집 가능) |
| 상태 동기화 | PR open -> IN_PROGRESS, merge -> DONE (완전 자동) |
| 구현 범위 | Tier 1 + Tier 2 동시 |

## 3. 아키텍처 개요

네 개의 독립 조각으로 나눈다. 각 조각은 명확한 인터페이스로만 통신한다.

1. **인증/설치 레이어** (`src/lib/github/`): GitHub App 크레덴셜로 installation token을
   발급한다(`@octokit/auth-app`). 설치 정보는 setup 콜백에서 DB에 저장한다.
2. **브랜치 생성(아웃바운드)** (`src/server/actions/github.ts`): 서버 액션이 git refs API로
   브랜치를 생성하고 링크를 저장한다.
3. **역동기화(인바운드)** (`src/app/api/github/webhook/route.ts`): GitHub 이벤트를 수신해
   브랜치명/PR 제목에서 태스크 키를 파싱하고 링크/PR 상태/태스크 status를 갱신한다.
4. **UI** (`src/components/detail/task-github.tsx`): 태스크 상세 사이드바 패널.
   `task-dependencies.tsx` 패턴을 미러링한다.

순수 로직(키 파싱, 브랜치명 빌드, 서명 검증, 상태 매핑)은 `src/lib/github/` 아래 테스트
가능한 순수 함수로 분리한다.

## 4. 데이터 모델 (Prisma 신규 2개)

```prisma
model GithubInstallation {
  id             String   @id @default(cuid())
  installationId Int      @unique   // GitHub 설치 ID
  accountLogin   String              // org/user 로그인명
  createdAt      DateTime @default(now())
}

model GithubBranchLink {
  id           String   @id @default(cuid())
  taskId       String
  task         Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  repoFullName String              // "owner/repo"
  branchName   String
  branchUrl    String
  prNumber     Int?                // PR 생기면 채워짐
  prState      String?             // OPEN | CLOSED | MERGED
  prUrl        String?
  prTitle      String?
  createdById  String?             // 앱으로 만든 사람(자동연결은 null)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([repoFullName, branchName]) // webhook 재전송 멱등 upsert 키
  @@index([taskId])
}
```

- `Task`에 역관계 `githubLinks GithubBranchLink[]`를 추가한다.
- 한 태스크가 브랜치 여러 개를 가질 수 있다(1:N).
- 한 브랜치는 최신 PR 하나를 표현한다(prXxx 필드). 브랜치당 PR이 여러 개 열리는 드문
  경우는 최신 것으로 덮는다(MVP 허용 범위).
- 마이그레이션 후 dev 서버 재시작 + `npx prisma generate` 필수(gotchas 필독 항목).

## 5. 인증/설치 레이어

- env: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`(PEM), `GITHUB_WEBHOOK_SECRET`.
  설치 ID는 env가 아니라 `GithubInstallation`에 동적 저장.
- `getInstallationOctokit()`: App JWT로 installation token을 발급해 인증된 Octokit
  인스턴스를 반환한다. 토큰은 1시간 만료이므로 요청마다 발급(또는 만료 캐시)한다.
- 설치 연결: GitHub App 설치 후 GitHub이 setup URL로 리다이렉트한다
  (`/api/github/setup?installation_id=...&setup_action=install`). 이 라우트에서
  `GithubInstallation`을 upsert한다. `installation` webhook 이벤트로도 갱신한다.
- 단일 워크스페이스(약 20인) 전제. 설치가 하나여도 테이블로 관리해 확장 여지를 둔다.

## 6. 브랜치 생성 흐름 (서버 액션)

`src/server/actions/github.ts`:

- `listInstallationRepos()`: `GET /installation/repositories`(페이지네이션)로 레포 목록
  반환. **`unstable_cache` 사용 금지**(gotchas 13: 멀티 replica에서 pod별 stale). 매 요청 조회.
- `createBranchForTask(input)`:
  1. 입력: `taskId`, `repoFullName`, `prefix`(feature|fix|chore), `branchName`(기본
     `{prefix}/{key}-{slug}`, 편집 가능), `base`(기본: 레포 default branch).
  2. installation Octokit 발급.
  3. base 미지정 시 `GET /repos/{o}/{r}` 로 default branch 조회.
  4. base SHA 조회: `GET /repos/{o}/{r}/git/ref/heads/{base}`.
  5. 브랜치 생성: `POST /repos/{o}/{r}/git/refs` `{ ref: "refs/heads/{name}", sha }`.
  6. `GithubBranchLink` upsert(`@@unique([repoFullName, branchName])` 기준).
  7. `revalidatePath`/`router.refresh`로 패널 갱신(read-your-own-writes).
- zod 스키마의 optional 필드는 `.nullish()` 사용(폼이 빈 값에 null 전송, gotchas 필독 항목).
- 기존 서버 액션(`tasks.ts`) 패턴(인증 체크 + 검증 + prisma + revalidate)을 따른다.

## 7. 역동기화 흐름 (webhook)

`src/app/api/github/webhook/route.ts` (POST):

- **보안**: raw body로 `X-Hub-Signature-256`(HMAC-SHA256, `GITHUB_WEBHOOK_SECRET`) 검증.
  실패 시 401. 검증 통과 후 즉시 200 반환(10초 제한), 처리는 동기 최소 작업으로.
- **멱등성**: 모든 쓰기는 upsert. replicas:2에서 인메모리 상태 금지, 재전송에도 안전.
- **구독 이벤트 -> 처리**:

  | 이벤트 | 조건 | 동작 |
  |--------|------|------|
  | `create` (ref_type=branch) | 이름에 유효 키 | 링크 생성(자동연결), 상태 변경 없음 |
  | `pull_request` opened/reopened/ready_for_review | head 브랜치+레포 매칭 또는 키 매칭 | PR 필드 갱신, 태스크 `IN_PROGRESS` |
  | `pull_request` closed & merged=true | 링크 매칭 | PR `MERGED`, 태스크 `DONE` |
  | `pull_request` closed & merged=false | 링크 매칭 | PR `CLOSED`, 상태 변경 없음 |
  | `pull_request` edited (title) | 링크 매칭 | prTitle 갱신 |
  | `installation` | - | `GithubInstallation` upsert/삭제 |

- **자동연결**: 앱을 거치지 않고 CLI 등으로 만든 브랜치/PR도 이름에 유효 키가 있으면 자동
  연결한다. 키 파싱은 모든 `Team.key` 접두어를 대조한 뒤 실제 태스크 존재(teamId+number)를
  검증한다. 매칭 실패는 에러가 아니라 무시.
- **키 다중 매칭**: 이름에 키가 여러 개면 첫 유효 키에 연결(MVP).

## 8. UI

`src/components/detail/task-github.tsx` (상세 사이드바, `task-dependencies.tsx` 미러링):

- "GitHub" 패널: 연결된 브랜치 목록(이름·레포·링크), PR 배지(번호, OPEN/MERGED/CLOSED
  상태색, 링크).
- "브랜치 생성" 버튼 -> 폼: 레포 select(**`OptionSelect` 필수** — Base UI SelectValue 함정),
  prefix select(feature/fix/chore), 브랜치명 input(자동 채움·편집), base 표시.
- `Card` 여백 규칙 준수(`CardContent` `py-0`, `divide-y` 리스트 `gap-0`).
- DESIGN.md 라이트 테마·토큰 준수, 새 액센트 색 도입 금지. PR 상태 배지는 기존 상태/우선순위
  태그 색 체계 재사용.

## 9. 에러/엣지 케이스

- 브랜치 이미 존재(422) -> 친절한 사용자 메시지, 액션은 실패 반환.
- 레포 접근 불가/토큰 만료 -> 재발급 후 재시도, 그래도 실패 시 명확한 에러.
- 키 매칭 실패 -> 무시(정상 흐름).
- default branch 미지정 -> 레포 API 조회로 보완.
- 태스크는 soft-delete 없음 -> 휴지통 유출 이슈 해당 없음.
- installation rate limit 15,000/hr per installation -> 현 규모에서 여유.

## 10. 테스트 (Vitest 순수 로직, 기존 `src/lib/*.test.ts` 패턴)

- `buildBranchName(prefix, key, title)` -> slug 규칙(소문자·하이픈·특수문자 제거).
- `parseTaskKeyFromRef(name, teamKeys)` -> `DESIGN-12` 추출/검증.
- `verifyWebhookSignature(rawBody, signature, secret)` -> HMAC 검증.
- `prEventToStatus(action, merged)` -> `Status` 매핑.
- webhook 핸들러/서버 액션은 DB·네트워크 바운드 -> 수동 검증 + 후속 Playwright 스모크.

## 11. 의존성 & 인프라 (사전 준비)

- **npm 의존성 없음**: GitHub 호출은 `fetch` + Node `crypto`로 처리한다(App JWT는 RS256
  서명, installation token 교환, webhook은 HMAC-SHA256 검증). 필요한 GitHub API 표면이
  5개 호출뿐이라 octokit 없이 충분하고, 이러면 워크트리의 symlink node_modules 함정을 피해
  `tsc`/`eslint`/`vitest`로 전부 검증된다. (초안은 `@octokit/*` 사용을 전제했으나 워크트리
  검증성을 위해 무의존 방식으로 전환.)
- **env 추가**(`.env.example`에도 반영): `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`,
  `GITHUB_WEBHOOK_SECRET`.
- **GitHub App 등록**(org 관리자 필요):
  - 권한: Contents Read/Write(브랜치 생성), Pull requests Read, Metadata Read.
  - 구독 이벤트: create, pull_request, installation.
  - webhook URL: `https://sprint.suitestudy.com:4641/api/github/webhook`, 시크릿 설정.
  - setup URL: `https://sprint.suitestudy.com:4641/api/github/setup`.
- **서비스 도메인**: prod 접속 주소는 `https://sprint.suitestudy.com:4641/` (포트 4641 포함,
  k3s Traefik ingress 뒤). NextAuth `AUTH_URL`/Google OAuth 콜백이 쓰는 도메인과 동일하다.
  webhook은 비표준 포트(`:4641`)를 payload URL에 그대로 지정한다. GitHub 서버(공인망)에서 이
  포트가 인바운드로 열려 있어야 하며, App 등록 후 "Recent Deliveries"의 ping 재전송으로 도달을
  확인한다.
- **prod webhook 도달성**: 미들웨어가 없어 `/api/github/webhook`은 공개 접근 가능. 인증 대신
  HMAC 서명으로 보호한다. 라우트는 자체적으로 `auth()`를 호출하지 않는다.
- **로컬 개발**: GitHub이 localhost에 도달할 수 없으므로 webhook 테스트에는 터널(smee.io,
  ngrok 등)이 필요하다. 브랜치 생성(아웃바운드)은 터널 없이 가능하다.

## 12. 구현 순서(제안, writing-plans에서 구체화)

1. Prisma 스키마 + 마이그레이션 + generate.
2. 순수 로직 유닛(`src/lib/github/*`) + 테스트.
3. 인증/설치 레이어 + setup 라우트.
4. 브랜치 생성 서버 액션 + 레포 목록 액션.
5. webhook 라우트(서명 검증 + 이벤트 처리).
6. UI 패널 + 상세 사이드바 연결.
7. `.env.example`·문서(gotchas/work-log) 갱신.

## 13. 명시적 비범위(YAGNI)

- per-user GitHub OAuth 귀속(누가 만들었는지 개인 계정 연동) — 후속.
- `push` 이벤트/커밋 미리보기 — 후속.
- 스마트 커밋 명령(`#done`, `#time`) 파싱 — 후속.
- 멀티 워크스페이스/멀티 설치 UI — 데이터 모델만 확장 가능하게 두고 UI 미구현.
- 상태 자동 전이 on/off 토글 — 우선 고정 동작, 필요 시 후속 설정화.
