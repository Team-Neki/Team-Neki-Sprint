# Sprint MCP 서버 설계 (티켓/위키 도구 + 팀 배포)

- 날짜: 2026-07-17
- 브랜치: `feat/mcp-server` (worktree: `.worktrees/mcp-server`, base: `main`)
- 상태: 승인됨 (구현 계획 수립 단계로 진행)

## 목적

Claude Code / Claude Desktop / Cursor 등 MCP 클라이언트에서 팀의 Sprint 앱에 대해
**티켓 생성·수정·조회·검색**과 **위키 생성·수정·조회·검색**을 수행할 수 있는 MCP 서버를
만든다. 다른 팀원도 동일 MCP를 받아 자기 계정으로 사용할 수 있어야 한다.

## 확정된 결정 사항

| 결정 | 선택 |
|---|---|
| 연동 방식 | 앱에 HTTP API + 개인 토큰(Bearer) 추가, MCP는 그 API를 호출하는 얇은 클라이언트 |
| 접속 대상 | k8s에 배포된 공용 인스턴스 |
| 작성자 귀속 | 개인 토큰 → 본인 계정 (활동로그가 실제 본인으로 기록) |
| 도구 범위 | 핵심(생성/수정/조회/검색) + 조회 보조(팀·멤버·에픽 목록). **삭제는 미노출** |
| 배포 | 레포 내 `mcp/` + 프로젝트 `.mcp.json`, 그리고 npm 패키지 둘 다 |
| 토큰 발급 | 앱 설정 페이지의 셀프서비스 발급 UI |

## 조사로 확인된 기존 구조 (근거)

- 모든 변경은 Next.js Server Action(`"use server"`)으로만 이뤄지고 REST API가 없음.
- 서버 액션은 `requireUser()`(`src/lib/session.ts`, NextAuth `auth()`)로 유저를 해석한 뒤
  이슈키 생성(`nextTeamNumber`), 활동로그(`logActivity`), 알림(`notifyNewMentions`/notification),
  위키 리비전, 캐시 무효화(`revalidatePath`)까지 함께 처리함.
- 인증은 Google Workspace SSO 세션 전용(`src/auth.ts`), DB 세션 전략. API 토큰 개념 없음.
- DB는 원격 PostgreSQL(`DATABASE_URL`), 프로덕션은 `replicas: 2`(gotchas §13 — `unstable_cache` 금지).
- `Task.description`은 `String? @db.Text`(평문). `WikiPage.content`는 `Json`(Tiptap doc).
- 이슈키는 `formatIssueKey(team.key, number)` → `TEAM-123`. `teamId`는 티켓 생성 시 필수.
- 검증 스키마: `taskSchema`, `wikiPageSchema` (`src/lib/validators.ts`). optional은 `.nullish()` 규칙.
- 조회 함수는 `src/server/queries.ts`(`getTask`/`getWikiPage`/`searchTasks`/`searchWikiPages`/`getMembers` 등),
  `requireUser`를 직접 타지 않는 순수 prisma 쿼리.

## 아키텍처

```
[팀원 MCP 클라이언트]            [배포된 Next.js 앱 (k8s)]            [PostgreSQL]
Claude Code/Desktop/Cursor
   │ stdio                          │
   ▼                                ▼
mcp/ (Node, MCP SDK) ──HTTP+Bearer──> /api/mcp/v1/*  ──> core 로직 ──────> Prisma
   env:                              (ApiToken 인증 가드)   (nextTeamNumber,
   SPRINT_API_URL                                          logActivity, notify,
   SPRINT_API_TOKEN                                        revalidatePath)
```

핵심 원칙: 이슈키/활동로그/알림/리비전/캐시 무효화 로직을 MCP에 복제하지 않는다.
4개 mutation을 "actor 주입 가능"하게 소폭 리팩터링해 서버 액션과 API 라우트가 같은 core를 공유.

## 컴포넌트

### A. 앱 측 (Next.js)

**A1. `ApiToken` Prisma 모델 (마이그레이션)**
```prisma
model ApiToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name       String                 // 라벨 (예: "MCP - 노트북")
  tokenHash  String    @unique      // sha-256(원문). 원문 미저장
  prefix     String                 // 표시용 앞 일부 (예: sprint_pat_ab12…)
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())
  revokedAt  DateTime?
  @@index([userId])
}
```
`User`에 `apiTokens ApiToken[]` 관계 추가. 토큰 형식 `sprint_pat_<32B base64url>`.
생성 시 원문 1회만 노출, DB엔 해시만 저장.

**A2. 토큰 인증 헬퍼 `src/lib/api-token.ts`**
- `generateToken()` → `{ raw, hash, prefix }`
- `hashToken(raw)` → sha-256 hex
- `authenticateBearer(req)` → `Authorization: Bearer` 파싱 → `tokenHash` 조회(`revokedAt: null`)
  → user 로드 → `lastUsedAt` 갱신(쓰로틀) → user | null 반환.
- 순수 로직(파싱/해시)은 유닛테스트, DB 조회는 통합 경로.

**A3. mutation core 리팩터링 (actor 주입, 시그니처 하위호환)**
대상 4개. 서버 액션의 외부 시그니처는 그대로 두고 내부만 분리:
- `createTask(input)` → `createTaskCore(actor, data)` 위임
- `updateTaskFields(id, input)` → `updateTaskFieldsCore(actor, id, patch)` 위임
- `createWikiPage(input)` → `createWikiPageCore(actor, data)` 위임
- `updateWikiContent(id, title, content)` → `updateWikiContentCore(actor, id, title, content)` 위임
`actor`는 `{ id, role }`(기존 `Actor` 타입 재사용). API 라우트는 토큰 유저로 core 호출.
`revalidatePath`는 라우트 핸들러에서도 동작하므로 core 내부 유지 가능.

**A4. API 라우트 핸들러 `src/app/api/mcp/v1/`**
공통 Bearer 가드. 사람이 읽기 쉬운 식별자 수용(teamKey, assigneeEmail, 이슈키) → 서버에서 id 해석.

| 메서드/경로 | 기능 | 위임 대상 |
|---|---|---|
| `POST /api/mcp/v1/tasks` | 티켓 생성 | `createTaskCore` |
| `PATCH /api/mcp/v1/tasks/[id]` | 티켓 수정 | `updateTaskFieldsCore` |
| `GET /api/mcp/v1/tasks/[idOrKey]` | 티켓 단건 | `getTask`(+key 해석) |
| `GET /api/mcp/v1/tasks` | 티켓 검색/목록 | `searchTasks`/필터 쿼리 |
| `POST /api/mcp/v1/wiki` | 위키 생성(+본문) | `createWikiPageCore` (+본문 시 `updateWikiContentCore`) |
| `PATCH /api/mcp/v1/wiki/[id]` | 위키 제목/본문 수정 | `updateWikiContentCore` |
| `GET /api/mcp/v1/wiki/[id]` | 위키 조회 | `getWikiPage` |
| `GET /api/mcp/v1/wiki` | 위키 검색 | `searchWikiPages` |
| `GET /api/mcp/v1/teams` | 팀 목록(id·key) | 신규 경량 쿼리 |
| `GET /api/mcp/v1/members` | 멤버 목록(id·email·name) | `getMembers` |
| `GET /api/mcp/v1/epics` | 에픽 목록(id·key·title) | 신규 경량 쿼리 |

응답: JSON `{ ok, data }` / 에러 `{ ok:false, error, issues? }`(zod issue 평탄화). 401은 인증 실패.
생성/조회 응답에 이슈키와 딥링크(`/tasks/{id}`, `/wiki/{id}`) 포함.

**A5. 위키 본문 텍스트→Tiptap 변환 `src/lib/text-to-doc.ts`**
LLM 산출 마크다운 서브셋(문단, `#` 제목, 목록, 펜스 코드, 굵게/기울임/링크)을 Tiptap doc JSON으로.
`docToPlainText`의 역방향. 표·mermaid 완전 충실 변환은 후속. `contentJson` 원본 직접 전달 경로도 허용.
순수 함수 → 유닛테스트.

**A6. 토큰 발급 설정 페이지 `/settings/tokens`**
셀프서비스 UI: 토큰 생성(이름 입력) → 원문 1회 노출 + 복사, 목록(prefix·이름·마지막 사용·생성일), 폐기.
서버 액션 `createApiToken(name)`(원문 반환)·`revokeApiToken(id)`. shadcn + `DESIGN.md` 준수
(near-white 라이트, ink primary, `Card` 여백 규칙 등). 기존 설정/프로필 위치에 통합(구현 시 확정).

### B. MCP 서버 `mcp/`

- TypeScript + `@modelcontextprotocol/sdk`, stdio 트랜스포트, 자체 `package.json`(`@team-neki/sprint-mcp`).
- env: `SPRINT_API_URL`, `SPRINT_API_TOKEN`. 미설정 시 명확한 기동 에러.
- 얇은 HTTP 클라이언트(`src/client.ts`) + 도구 정의(`src/tools/*`) + 엔트리(`src/index.ts`).
- 도구(핵심 + 조회 보조, 삭제 미포함):
  - `create_ticket`(title, team[key|id], description?, status?, priority?, assignee[email|id]?, epicId?, startDate?, dueDate?, estimatedMd?)
  - `update_ticket`(idOrKey, ...부분 필드)
  - `get_ticket`(idOrKey)
  - `search_tickets`(query?, status?, assigneeEmail?, teamKey?, limit?)
  - `create_wiki_page`(title, body?(markdown)|contentJson?, parentId?, folderId?)
  - `update_wiki_page`(id, title?, body?|contentJson?)
  - `get_wiki_page`(id)
  - `search_wiki_pages`(query, limit?)
  - `list_teams`, `list_members`, `list_epics`
- 도구 입력은 zod로 검증. 결과 텍스트에 이슈키 + 딥링크 URL 포함.
- API 4xx/5xx → 읽기 쉬운 도구 에러 메시지(zod issue 표면화).

### C. 팀 배포

**C1. 레포 내 + 프로젝트 `.mcp.json`**
```jsonc
{ "mcpServers": { "sprint": {
  "command": "node", "args": ["mcp/dist/index.js"],
  "env": { "SPRINT_API_URL": "https://<배포도메인>",
           "SPRINT_API_TOKEN": "${SPRINT_API_TOKEN}" } } } }
```
토큰 미커밋 — 각자 셸/`.env`에 `SPRINT_API_TOKEN`. 팀원 절차:
`git pull → cd mcp && npm i && npm run build → export SPRINT_API_TOKEN=… → Claude Code 재시작`(프로젝트 MCP 승인).

**C2. npm 패키지**
`@team-neki/sprint-mcp` 게시(공개 또는 사내/GitHub 레지스트리). 레포 없이 Desktop/Cursor에서
`npx -y @team-neki/sprint-mcp` + env(URL·토큰)로 사용.

**C3. `mcp/README.md`**
Claude Code(project `.mcp.json`)·Claude Desktop(`claude_desktop_config.json`)·Cursor 3종 설정법,
그리고 설정 페이지에서 토큰 받는 절차 문서화.

## 데이터 흐름 (예: create_ticket)

1. 어시스턴트가 `create_ticket{ title, team:"NEKI", assigneeEmail }` 호출.
2. MCP가 `POST /api/mcp/v1/tasks` (Bearer 개인토큰) 전송.
3. 라우트: Bearer 인증 → 유저 해석 → teamKey→teamId, email→userId 해석 → `taskSchema.parse` →
   `createTaskCore(user, data)` → 이슈키/활동로그/무효화 → `{ id, key, url }` 반환.
4. MCP가 이슈키 + 딥링크를 텍스트로 반환.

## 에러 처리

- 인증 실패 → 401 `{ ok:false, error:"unauthorized" }` → 도구가 "토큰 확인" 메시지.
- 검증 실패 → 400 + zod issues 평탄화 → 도구가 필드별 사유 표시.
- 참조 해석 실패(없는 teamKey/email/key) → 404/422 + 후보 안내.
- 서버 오류 → 500, 메시지 마스킹, MCP는 재시도 아닌 명확한 실패 반환.

## 테스트

- Vitest 유닛: `api-token`(파싱·해시), `text-to-doc`(변환), MCP 도구 입력 스키마, 라우트 핸들러(prisma mock).
- 기존 `src/lib/*.test.ts` 패턴 준수. `npm run test`로 실행.
- 수동 스모크: 로컬 dev + 시드 토큰으로 각 도구 1회 왕복(병합 후 main에서).

## 보안

- 토큰 해시 저장·원문 1회 노출·폐기 가능·유저 스코프.
- 삭제 도구 미노출(파괴 방지). 기존 삭제 authz(작성자/ADMIN)는 그대로.
- 엔드포인트는 세션 쿠키 비의존(순수 Bearer). 로그인 도메인 제한(`ALLOWED_EMAIL_DOMAIN`)은 로그인 단계에 이미 존재.
- `lastUsedAt` 추적으로 미사용 토큰 식별.

## 엔지니어링 함정 (기존 gotchas 반영)

- **worktree + Turbopack**: `next build/dev` 거부. 이 worktree 검증은 `tsc --noEmit` + `eslint`만.
  통합 빌드/`npx prisma generate`/`npm install`은 **병합 후 main**에서.
- **스키마 변경 후 dev 재시작**. optional 필드는 `.nullish()`. `Card` 여백 규칙(`py-0`, `divide-y`→`gap-0`).
- **`unstable_cache` 재도입 금지**(replicas:2). API 라우트도 매 요청 DB 직접 조회.
- node_modules는 main에서 symlink됨. `prisma generate`는 공유 client에 영향(추가 모델이라 저위험) — 병합 후 main에서 정식 재생성.

## 빌드 순서 (구현 계획의 뼈대)

1. `ApiToken` 스키마 + `src/lib/api-token.ts` + 유닛테스트
2. mutation core 리팩터링(4개) — 기존 테스트 녹색 유지
3. `src/lib/text-to-doc.ts` + 유닛테스트
4. `/api/mcp/v1/*` 라우트 핸들러 + 라우트 테스트
5. `/settings/tokens` 발급 UI + 서버 액션
6. `mcp/` 패키지(클라이언트·도구·엔트리) + 도구 스키마 테스트
7. `.mcp.json` + `mcp/README.md` 배포 문서
8. 병합 후 main에서 `prisma migrate` + `prisma generate` + `npm install`(mcp 포함) + 통합 스모크

## 범위 밖(후속)

- 삭제/의존성/라벨 부여/코멘트 도구.
- 마크다운 표·mermaid 완전 충실 변환.
- 토큰 만료(TTL)/스코프 세분화/레이트리밋.
- SSE/HTTP 스트리밍 트랜스포트(현재 stdio 로컬 실행으로 충분).
