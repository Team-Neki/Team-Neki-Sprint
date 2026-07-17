# 작업 로그

세션 단위로 무엇을·왜 바꿨는지 기록한다. 최신 항목이 위.

## 최근 세션 요약

한눈에 보는 최근 작업·상태. 상세는 아래 각 세션 참조. 백로그 항목별 상태는 [roadmap-v2 상태 현황](./roadmap-v2.md#상태-현황요약).

| 날짜 | 세션 | 상태 |
|---|---|---|
| 2026-07-18 | 대시보드/멘션/공지/캐시/표 편집 9건+: 최근 활동 위키 제목 표기, 팀 멘션(`teamMention`+팀원 확장 알림), 공지(`Announcement` 모델·대시보드 상단 카드·상세/작성/수정, 삭제는 작성자만), TTL 인메모리 캐시(`lib/server-cache`, 검색/멘션 자동완성 적용), 위키 수정 버튼 헤더 이동, 표 편집(끝 추가·양방향 드래그·우클릭 메뉴·Ctrl+Opt+방향키/Ctrl+Backspace 단축키) | `DONE`\* |
| 2026-07-17 | GitHub 연동(Task->Branch->PR 양방향): 태스크 상세에서 브랜치 생성(`prefix/KEY-slug`, 레포 생성 시 선택), webhook(`/api/github/webhook`) 으로 PR open->IN_PROGRESS·merge->DONE 자동 전이 + 이름규칙 자동연결. GitHub App(installation token), 신규 npm 의존성 없이 fetch+node:crypto. 모델 `GithubInstallation`/`GithubBranchLink`. 설계 `specs/2026-07-17-github-integration-design.md`, 계획 `plans/2026-07-17-github-integration.md` | `DONE`\* |
| 2026-07-17 | 위키/타임라인/레이아웃 22건(worktree 5-스트림 병렬): 사이드바 폴더 접힘 유지·새 하위폴더 즉시노출·토글/리사이즈, 저장/취소 헤더 이동, 타임라인 막대 라벨 제거, 에디터(슬래시커맨드·글자색·표 크기픽커/드래그 다중추가·삭제·h1~h6·툴팁 속도·코드강조 채도↑·툴바 H/목록 아이콘 제거), 휴지통 다중선택·다중삭제·비우기, 전역 모바일드로어 이동시 닫힘·사이드바 리사이즈 | `DONE`\* |
| 2026-07-15 | 폼/목록/타임라인/위키 UX 다수: 담당자 기본값·폼 리셋 버그, 목록 컬럼 통일+빈 헤더, 타임라인 무한스크롤·2색, round 축소, 위키 코드블록(복사·언어·자동닫기·들여쓰기)·표 편집(삭제·추가버튼·리사이즈), 스프린트 컬럼·MD 소수점 | `DONE`\* |
| 2026-07-13 | 위키 본문 이미지 저장 DB(BYTEA) → S3 이관 | `DONE`\* |
| 2026-07-13 | 위키 저장 후 사이드바 제목 stale 버그 근본원인 = `unstable_cache` 가 멀티 replica 에서 pod-local → **데이터 캐시 레이어 제거** | `DONE` |
| 2026-07-10 | 프로필 상세·타임라인 구분선·위키 DnD·티켓 CC·상세 시트 정련 등 in-product UX 다수 (커밋 `66f8eb5` + 후속) | `DONE`\* |
| 2026-07-09 | 추정 단위 MD 일원화 · 목록/상세/타임라인 UX 개선 · 리뷰 상태 제거 (커밋 `0984416`) | `DONE`\* |
| 2026-07-09 | 위키 리치 렌더링(표·코드 구문강조·mermaid, D13) | `DONE`\* |
| 2026-07-09 | 에러/로딩 바운더리(D12) + 태스크 의존성(D11) | `DONE` |
| 2026-07-09 | 위키 본문 전문검색(D10) + 백로그 문서 현행화 | `DONE` |
| 2026-07-09 | 반응형 개선(특히 위키) | `DONE` |
| 2026-07-09 | 백로그 D3(캐시)·D9(a11y) 마무리 | `DONE` |
| 2026-07-09 | 목록 개편(인라인 편집+슬라이드 상세)·프로필 메뉴 | `DONE` |
| 2026-07-09 | 전체 감사 개선 P1~P4(그룹 D) | `DONE` |
| ~2026-07-08 | Phase 1~4 + 로드맵 v2 8건 (이하 15개 세션) | `DONE` |

\* 코드·빌드·테스트 검증 완료. 실렌더(mermaid/표/강조)는 로그인 게이트라 브라우저 확인 필요.

---

## 2026-07-18 — 대시보드/멘션/공지/캐시/표 편집 (브랜치 `feat/dashboard-notice-editor-improvements`)

- **대시보드 최근 활동 위키 제목**: `getDashboardData` 가 wiki 활동의 `entityTitle` 을 채우지 않아 "위키 수정"만 떴다 → wiki id 로 제목 lookup 추가(휴지통 페이지도 제목만 보강 — 목록 유출 아님).
- **팀 멘션**: `teamMention` 노드(`team-mention.tsx`) 신설, '@' suggestion(person-mention)이 팀+멤버 통합 노출(`searchMentionTargets`). 알림은 `server/notify.newMentionRecipients` 가 팀을 팀원 전원으로 확장(차집합·자기 제외 규칙 동일). 위키/태스크/에픽/프로젝트 설명·댓글 모두 적용.
- **공지(Announcement)**: 새 모델(작성자 SetNull) + `/announcements`(목록)·`/announcements/[id]`(상세, `?edit=1` 로 생성 직후 편집 진입). 대시보드 최상단 강조 카드(잉크 아이콘+인셋 밴드, 새 액센트 색 없음). 에디터는 위키 구성요소(`wikiExtensions`·`Toolbar`·`TableHoverControls` export) 재사용, draft 시스템은 미사용. 수정은 전원, **삭제는 작성자만**(author null 이면 ADMIN). 본문 멘션 알림 지원(`entityType: "announcement"`).
- **TTL 인메모리 캐시**(`lib/server-cache.ts`): `cached(key, ttl, loader)`+in-flight dedupe+FIFO 상한. **pod-local 이므로**(gotchas §13) read-your-own-writes 가 필요 없는 검색 경로에만 적용: 전역 검색 15s·멘션 자동완성 30s.
- **위키 수정 버튼**: 본문 제목 행 → sticky 헤더 '...' 좌측으로 이동(저장/취소와 같은 자리).
- **표 편집(T22)**: `table-edit.ts`(prosemirror-tables low-level) 신설.
  - hover `+` 클릭/드래그 추가가 커서 무관 **항상 마지막 행/열 뒤**. 표 팝오버 메뉴도 동일("맨 아래/맨 오른쪽").
  - 드래그 **양방향**: 반대로 끌면 끝에서부터 삭제하되 **빈 행/열까지만**(내용 셀에서 멈춤).
  - 셀 **우클릭 컨텍스트 메뉴**(`table-context-menu.tsx`): 셀=좌/우 열·위/아래 행 추가+열/행 삭제, 행 전체 선택=행 메뉴, 열 전체 선택=열 메뉴.
  - **단축키**(`table-controls.ts`): Ctrl+Opt+←/→/↑/↓ 커서 기준 열/행 추가, 행/열 전체 선택 후 Ctrl+Backspace 삭제(표 전체 선택이면 표 삭제 — prosemirror-tables 는 전행/전열 삭제를 거부).
- **읽기 경로 인덱스 3종**(후속 리뷰에서 추가): Postgres 는 FK 에 인덱스가 자동 생성되지 않아, 계속 자라는 테이블의 FK 조회가 seq scan 이었다 → `WikiRevision @@index([pageId, createdAt])`(버전 히스토리·저장마다 1건씩 쌓임), `Comment @@index([taskId, createdAt])`(태스크 상세 댓글), `WikiPageTaskLink @@index([taskId])`(태스크→위키 역방향, PK 는 pageId 선두라 못 탐). cascade 삭제 시 자식 스캔 비용도 함께 해소. 검색(`contains`)은 B-tree 대상이 아니므로 데이터가 커지면 `pg_trgm` 별도 검토.

## 2026-07-17 — 위키/타임라인/레이아웃 22건 (브랜치 `feat/wiki-editor-layout-improvements`)

사용자 요청 22건을 파일 겹침 기준 5개 워크스트림으로 나눠 **git worktree 병렬**로 구현(WS1 사이드바·WS4 휴지통·WS5 셸은 백그라운드 서브에이전트, WS2 타임라인·WS3 에디터는 메인 트리). 각 worktree 는 `tsc`+`eslint` 로만 검증(Turbopack 이 worktree symlink node_modules 거부, [gotchas §6]) 후 브랜치로 커밋 → 메인 통합 브랜치에 병합. 통합 후 tsc 0 · eslint 0 · `next build` OK · vitest 106 pass. **상호작용/시각(슬래시 메뉴·표 드래그 추가·색상·폴더 접힘 영속·사이드바 리사이즈)은 로그인 게이트라 브라우저 실확인 후속 필요.**

- **통합 전 함정**: 메인의 생성 Prisma client 가 checked-in `schema.prisma`(WikiImage `data Bytes`)와 어긋나 있었다(형제 worktree 의 S3 `s3Key` 스키마로 생성돼 있던 잔재) → 위키 이미지 라우트 tsc 3건 에러. `npx prisma generate` 로 재생성해 해소. [gotchas §30]

### WS1 사이드바 — 폴더 접힘 유지·새 하위폴더 즉시노출·토글/리사이즈 (`page-tree.tsx`, `wiki-sidebar.tsx`, `wiki/layout.tsx`)
- **폴더 접힘 상태 유지**: 근본원인은 부모 접힘 시 자식 `<ul>` 이 언마운트돼 재오픈 때 자식 `useState(true)` 가 재초기화되던 것. 열림/닫힘을 `FolderItem`/`PageItem` 로컬 state 에서 빼내 **`PageTree` 소유 `collapsedIds: Set`**(id 네임스페이스 `f:`/`p:`)로 승격, `open=!collapsedIds.has(key)`. localStorage `wiki:collapsed` 영속. [gotchas §31]
- **새 하위폴더/페이지 즉시 노출**: 생성 시 부모를 `collapsedIds` 에서 빼 강제 펼침(`expand`) + 새 노드도 펼침.
- **사이드바 토글/리사이즈**: `wiki/layout.tsx` 의 서버 `aside` 를 클라이언트 `WikiSidebar` 로 추출(접힘 `wiki:sidebar`, 폭 `wiki:sidebarW` 200~480, 타임라인 `onResizeStart` 패턴 재사용). 데스크톱 전용(`hidden md:block`), 모바일은 `WikiNavSheet` 유지.

### WS2 타임라인 — 막대 위 라벨 제거 (`epic-timeline.tsx`)
- 에픽 막대 내부 sticky 라벨(`N 태스크`/종료일) 제거 → 순수 막대만. 좌측 이름 열·상단 월/일 축·`일정 미설정` placeholder 는 유지. 제목은 hover `title` 로만.

### WS3 에디터 (`editor.tsx`, `wiki-detail.tsx`, `extensions.ts`, `slash-*.ts(x)`, `globals.css`)
- **저장/취소 헤더 이동**: `WikiEditor` 를 `forwardRef`+`useImperativeHandle({commit,cancel})` 로, `onStateChange` 로 상태 상향. `WikiDetail` 의 sticky 헤더에서 `...` 메뉴 좌측에 취소·저장·상태 렌더 → 긴 본문 스크롤에도 고정.
- **슬래시 커맨드(/)**: `@tiptap/suggestion` 기반 `SlashCommand` 확장 + `SlashMenu`. 제목1~6·글머리/번호/체크 목록·인용·코드·표·mermaid·구분선. 코드블록 내부·단어 중간 트리거 제외.
- **글자 색상**: `@tiptap/extension-text-style`+`@tiptap/extension-color`(정확히 3.27.1 핀 — `^` 은 core 3.28.0 를 끌어와 peer 충돌) + 툴바 팔레트 버튼.
- **표**: 삽입 버튼에 hover 크기 그리드 픽커(최대 8×8). hover 컨트롤 + 버튼을 드래그하면 거리만큼 열/행 다중 추가, 인라인 삭제(−) 버튼 추가.
- **제목/툴바**: heading `levels:[1..6]` + h4~h6 CSS. 툴바에서 H1/H2/H3·목록/체크 아이콘 제거(#·마크다운·슬래시로). 아이콘 툴팁을 네이티브 `title` → Base UI Tooltip(≈150ms).
- **코드 하이라이팅**: `.hljs-*` 팔레트 채도 상향 + 토큰 클래스 보강(키워드 빨강·문자열 초록·숫자 파랑·함수 보라·타입/속성 주황).

### WS4 휴지통 — 다중선택·다중삭제·비우기 (`trash-list.tsx`, `actions/wiki.ts`)
- `TrashList` 를 선택 state 소유로(행 `Checkbox`+전체 선택). 신규 액션 `purgeWikiPages(ids)`·`emptyWikiTrash()` — `canManage`(작성자/ADMIN, [authz]) 통과분만 삭제(권한 없는 항목은 배치 중단 없이 건너뜀). `ConfirmDelete` 재사용(확인·토스트·refresh 담당).

### WS5 전역 셸 — 모바일 드로어 닫힘·사이드바 리사이즈 (`layout.tsx`, `sidebar-collapse.tsx`, `mobile-nav.tsx`)
- 전역 모바일 `Sheet` 를 클라이언트 `MobileNav` 로 추출 → 경로 변경 시 자동 닫힘(`WikiNavSheet` 의 render-중 조건부 setState 패턴). 데스크톱 레일은 불변.
- `SidebarProvider` 에 `width`(localStorage `app:sidebarW`, 200~400) 추가. `DesktopSidebar` 펼침 시 인라인 폭 + 우측 드래그 핸들(접힘 레일 땐 숨김).

## 2026-07-15 — 폼/목록/타임라인/위키 UX 다수 (브랜치 `fix/dialog-form-reset-owner-default`)

한 세션에서 사용자 요청을 순차 처리(요청 완료마다 커밋). 모두 tsc 0 · eslint 0 · `next build` OK · vitest 106 pass. **상호작용/시각 동작(타임라인 무한스크롤, 표 편집, 코드블록 편집, round 룩)은 브라우저 실확인 미완** — 로그인 게이트라 후속 QA 필요.

### 폼 버그 2건 (커밋 `0d0137d`)
- **담당자 미지정인데 만든 사람으로 지정**: `createProject`/`createEpic` 의 `ownerId: data.ownerId ?? user.id` 폴백 제거 → 미지정은 null 유지. 태스크는 해당 없음(assignee 는 null 유지, `reporterId=user.id` 는 작성자라 의도된 동작). 다른 필드엔 숨은 기본값 주입 없음(grep 확인).
- **다이얼로그 재열림 시 이전 입력 잔존**: 필드 `useState` 가 항상 마운트된 최상위 다이얼로그에 있어 초기화가 1회뿐이었음. Base UI 는 닫히면 popup 하위를 언마운트(`keepMounted=false`)하므로, **필드 state 를 `DialogContent` 하위 자식 폼 컴포넌트로 분리** → 매 열림마다 새 마운트로 리셋. project/epic/task/sprint/team 5개 다이얼로그. [gotchas §24]

### 목록 컬럼 통일 + 빈 목록 헤더 (커밋 `4a9515f`)
- 에픽/태스크 표를 프로젝트와 동일 순서(`제목·담당자·시작일·종료일·우선순위·상태·레이블`)로 재정렬. 키는 맨 앞, MD 맨 뒤 유지. 시작일/종료일/레이블 컬럼 신설. `getEpics` 에 labels include 추가.
- 목록 3종이 count 0 일 때 `EmptyState` 카드 대신 항상 표 렌더(헤더 노출, 빈 안내는 표 내부 EmptyRow).
- **라벨 셀 폭 깨짐**: auto-layout 표는 헤더 `w-40` 이 힌트라 라벨 추가 시 컬럼이 가로로 밀렸음 → 셀 내용을 `max-w-40` 로 감싸 줄바꿈. [gotchas §25]

### 타임라인 개편 (커밋 `f52394c`)
- **좌우 무한 스크롤**: 표시 창(range)을 state 로, 스크롤이 가장자리에 오면 CHUNK 만큼 과거/미래 확장. prepend 시 삽입 폭만큼 scrollLeft 보정(useLayoutEffect, pre-paint). 하루 셀 폭 고정(DAY_W)으로 확장 시 재스케일 없이 위치 보정 정확. 에픽/태스크 0건도 축·그리드 렌더로 스크롤 가능. [gotchas §26]
- 연도 전환 월은 `1월'27` 표기. 상태 2색 체계(완료=emerald, 그 외=blue, 에픽·태스크 공통). 에픽/태스크 막대 두께 통일(h-5). 범례 진행중/완료로 교체·확대.

### round 축소 (커밋 `3342621`)
- 전역 `--radius` 12px→8px(0.5rem). 모든 Tailwind `rounded-*` 파생 비례 축소. DESIGN.md rounded 토큰(정본)·docs/design-system.md·CLAUDE.md 동기화. pill/full 유지.

### 위키 코드블록 (커밋 `8ddd4ac` `c170af7` `ea4360b` `5ce884a` `0c607e0`)
- **복사 버튼**: CodeBlockLowlight 에 React NodeView(`code-block.tsx`) 를 붙여 우측 상단 복사. 코드 본문은 `NodeViewContent as="code"`(NoInfer 제네릭이라 타입인자 명시). [gotchas §27]
- **괄호/따옴표 자동 닫기**(`code-block-pairs.ts` ProseMirror 플러그인): 여는 문자 → 닫는 짝 삽입, 선택 감싸기, type-over. codeBlock 안에서만.
- **Enter 자동 들여쓰기**: `{`/`[` 뒤 +1단(빈 짝이면 세 줄 펼침), 그 외 들여쓰기 줄은 현재 들여쓰기 유지. `addKeyboardShortcuts` 에서 `this.parent` 로 베이스 단축키(Tab·Backspace·triple-Enter) 보존.
- **언어 지정+하이라이트**: NodeView 에 언어 select(Plain·Kotlin·Java·JSON·YAML·iOS/Swift — lowlight `common` 포함). `updateAttributes({language})`.
- **코드블록 내 #/@ 멘션 차단**: TicketMention/PersonMention Suggestion 에 `allow` 콜백(parent 가 codeBlock 이면 false).

### mermaid Enter 들여쓰기 (커밋 `08cce48`)
- mermaid textarea(controlled)에서 Enter 시 선행 공백 유지. `updateAttributes` 후 caret 이 끝으로 튀므로 pendingCaret ref + 재렌더 후 복원 effect.

### 스프린트 컬럼 + MD 소수점 (커밋 `93f4cf3`)
- 스프린트 표 `기간`(start–end) 단일 컬럼을 `시작일`/`종료일` 로 분리.
- **MD 부동소수점 노이즈**: `estimatedMd`/`actualMd` 가 `Float?` 라 합산 롤업에서 `0.1+0.2=0.30000000000000004` 노출. queries.ts 롤업 출력(sumMd·mdByEpic·getEpics·getSprints·getProject)에 `roundMd`(6자리) 적용 — 노이즈만 제거, 입력·저장값 보존. [gotchas §28]

### 위키 표 편집 (커밋 `af8f99a` `8e62b94` `9813b98`)
- **삭제**: 표 아래 블록 맨 앞에서 ArrowLeft → 표를 NodeSelection 선택 → Backspace/Delete 삭제(별도 `TableControls` 확장).
- **hover 열/행 추가**: 커서가 표 안이면 표 DOM rect 추적해 우측(열)·하단(행) 스트립 오버레이, hover 시 + 버튼. 표 내부 로직 미변경(좌표만 읽음).
- **리사이즈 폭 고정**: TableView 가 리사이즈로 세팅하는 table inline `width`/`min-width` 를 CSS `!important` 로 무시해 표를 컨테이너 100% 에 고정 → `table-layout:fixed` 상 경계선만 이동, 인접 열이 폭 나눔. [gotchas §29]

---

## 2026-07-13 — 위키 본문 이미지 저장 DB(BYTEA) → S3 이관

위키 에디터 첨부 이미지를 DB `WikiImage.data`(BYTEA)에 인라인 저장하던 것을 S3(또는 S3 호환 스토리지) 오브젝트로 이관. 검증: tsc 0 · vitest 106 pass · eslint clean(변경 3파일). DB 스키마 변경 1건 — 타 환경 `prisma migrate deploy` 필요. 스키마 변경 후 dev 서버 재시작 필수([gotchas §1]). **기존 이미지 데이터 없음 전제**로 하드 컷오버(`data` 컬럼 제거).

- **왜**: DB 비대화(바이너리 인라인) 해소 + 저장소 분리. presigned 대신 애플리케이션이 SDK 로 직접 저장/서빙하는 서버 프록시 방식 채택 — 트래픽이 낮아 서버 경유 오버헤드가 무의미하고, **"로그인 유저만 이미지 접근" 인증 게이트를 그대로 유지**할 수 있어서(presigned 는 이 보안 모델 재설계가 필요). URL 구조(`/api/wiki/image/<id>`)를 보존해 에디터·TipTap·`WikiPage.content` 는 무변경.
- **스키마**: `WikiImage.data Bytes` → `s3Key String`. `mimeType`/`name`/`size`/`uploaderId` 유지(마이그레이션 `20260713000000_wiki_image_s3`, `DROP COLUMN data` + `ADD COLUMN s3Key NOT NULL`). URL PK 는 여전히 cuid 라 content-addressed·immutable.
- **S3 래퍼**(`src/lib/s3.ts`): 지연 생성 싱글턴 `S3Client`(빌드 타임 env 부재로 안 터지게). 자격증명은 **코드에 두지 않고 AWS SDK 기본 credential provider chain**(k8s IRSA/IAM Role, 로컬 `~/.aws`/env) 사용. env 는 버킷·리전만(`S3_BUCKET`/`S3_REGION`), `S3_ENDPOINT`/`S3_FORCE_PATH_STYLE` 로 MinIO 등 S3 호환도 지원. `put`/`get`(웹 스트림)/`delete`(고아 정리용) 제공.
- **업로드**(`POST /api/wiki/upload`): 형식(PNG·JPEG·GIF·WebP)·5MB·SVG 차단·인증 검증은 그대로. S3 `Put` 성공 후 DB 에 `s3Key` 기록(S3 실패→502, DB 실패→S3 고아만 남고 사용자엔 실패 응답).
- **서빙**(`GET /api/wiki/image/[id]`): DB 에서 `s3Key`→S3 `Get` 스트림. 인증 게이트·`Cache-Control: private, immutable`·`nosniff`·`Content-Type`(DB `mimeType`) 그대로.
- **운영 주의**: 실행 환경에 `S3_BUCKET`/`S3_REGION` + S3 접근 권한(IAM Role) 주입 필요. 앱과 버킷을 **같은 AWS 리전**에 두면 S3→서버 전송비 0(egress 절감). 이미지 삭제 경로는 원래 없었음(영구 보존 설계) — GC 미배선, 필요 시 `deleteWikiImage` 활용.

---

## 2026-07-13 — 위키 사이드바 stale 버그: `unstable_cache` 멀티 replica pod-local → 캐시 제거

**증상**: "위키에 문서를 저장했을 때 좌측 사이드바의 문서 제목 변경이 간헐적으로 반영 안 됨."

**근본원인(멀티 인스턴스 캐시 비정합)**: `updateWikiContent`/`renameWikiPage` 의 무효화 배선(`updateTag`+`revalidatePath`+`router.refresh()`)은 정상이었다. 진짜 원인은 prod 가 `replicas: 2` 인데 `next.config` 에 공유 `cacheHandler` 가 없어 `unstable_cache`(`getWikiTree` 등 14개 쿼리)가 **pod 별 로컬 캐시**라는 것. mutation 은 처리한 pod 만 `updateTag` 로 무효화되고, 이어지는 `router.refresh()` 가 로드밸런서로 다른 pod 에 가면 stale 트리를 받는다(~50%, 최대 `revalidate` 백스톱까지). **dev·단일 인스턴스에선 재현 불가** → 팀의 dev 실확인이 이 버그를 못 걸렀음.

**진단 방법**: 같은 DB 에 각자 캐시를 가진 프로덕션 인스턴스 2개(격리 `distDir`)를 띄워 → B 사이드바 워밍 → A 에서 제목 저장 → **B 가 옛 제목 유지**를 확인(재현). 수정 후 같은 절차에서 **B 가 새 제목 즉시 반영**(fix 검증).

**수정(캐시 레이어 제거)**: 대안(Redis 공유 `cacheHandler`·`replicas:1`·sticky sessions) 중, 20인 내부 툴엔 캐시 이득이 미미하므로 **HA 유지 + 전 쿼리 정합 + 인프라 무추가**인 캐시 제거를 택함(사용자 결정).
- `src/server/queries.ts`: 14개 `unstable_cache` 래퍼 제거 → 순수 함수(매 렌더 DB 직접 조회). 공유 DB라 항상 fresh.
- `src/lib/cache.ts` 삭제. 8개 액션 파일에서 `bumpTags`/`CACHE_TAGS` 호출·import 제거(teams 의 `bumpTeamSurfaces` 헬퍼 포함). `revalidatePath`/`router.refresh()` 는 유지 — force-dynamic + 클라이언트 라우터 캐시 `staleTime` 0 이라 read-your-own-writes·교차목록 반영 보장.
- 문서: [gotchas §13](./gotchas.md) 재작성(재도입 금지 근거), CLAUDE.md 캐시 항목 갱신.

**검증**: tsc 0 · eslint 0 · vitest 106 pass · **2-인스턴스 prod 브라우저 실확인**(교차 pod fresh 반영).

**주의(재도입 금지)**: 멀티 replica 인 채로 `unstable_cache`/`use cache` 를 다시 쓰려면 반드시 공유 `cacheHandler`(Redis 등)를 먼저 설정. 안 그러면 이 버그가 재발한다.

---

## 2026-07-10 — 프로필 상세·타임라인 구분선·위키 DnD·티켓 CC·상세 시트 정련 등 UX 다수

커밋 `66f8eb5`(1차) + 후속(상세 시트 정련). 사용자 피드백 다수를 연속 반영. 검증: tsc 0 · vitest 106 pass · eslint clean + **브라우저 실확인**(상세 시트). DB 스키마 변경 1건(티켓 CC 다대다) — 타 환경 `prisma migrate deploy` 필요. 스키마 변경 후 dev 서버 재시작 필수([gotchas §8·필독]).

- **프로필/내 정보**: 헤더 유저 메뉴에 "내 정보" 추가(`user-menu` → `/users/[id]`). 본인 프로필에서 이름·연락처 인라인 수정(`ProfileDialog` + `updateProfile` 액션, `profileSchema` `.nullish()`). 상세 섹션 순서 오너 에픽→담당 태스크, 뒤로가기 라벨 "뒤로 가기"(동작은 이미 `router.back()`, 라벨만 오해 소지였음).
- **타임라인 구분선(이름 열 ↔ 그래프)**: 절대배치 오버레이+스크롤 동기화는 컴포지터 스크롤을 못 따라가 흔들리고, 거터 사이 틈으로 월 구분선이 침범 → **sticky 거터의 `border-r`** 로 전환(CSS sticky라 안 흔들림) + 거터 z-30/헤더 마스크 z-40 + 그룹 스페이서로 이름 열을 세로 연속화(행 `gap-0`·헤더 `mb` 제거)해 **끊김 없는 고정 구분선**. 이름 열 **드래그 리사이즈**(sticky 헤더 마스크 우측 핸들), 월 경계 세로 구분선, 구분선↔그래프 여백(`RULER_PAD`), 월/일 라벨 시작 정렬 통일(`CELL_PAD`), "일정 미설정" 텍스트를 스크롤 콘텐츠에 두어 그래프와 함께 이동. [gotchas §21]
- **위키 사이드바 DnD**: 페이지 드래그앤드롭 이동(행 상단/하단 30%=형제 순서변경, 중앙=하위 페이지 중첩, 폴더 드롭=폴더 이동, 하단 빈영역=루트). 콘텐츠 트리 내부 한정, 순환은 클라이언트+서버(`moveWikiPage`) 이중 차단, 형제 `position` 재색인. 제목/폴더명 **더블클릭 인라인 편집** + 실패 시 원복. 콘텐츠↔휴지통 여백 축소.
- **티켓(Task)**: **참조(c.c.) 다대다 컬럼** 추가(`Task.ccUsers` implicit m2m, 마이그레이션 `task_cc_users`) + `setTaskCc`(집합 교체) + `TaskCc` 멀티 유저 선택(칩·팝오버). 목록/보드 정렬에 **`id` tiebreaker** 추가(동점 행이 행 UPDATE 시 재배열되던 흔들림 방지, [gotchas §22]). 의존성 섹션 문구 **차단됨/차단함 → 선행/후속 작업**(+ 한 줄 설명).
- **상세 시트(우측 슬라이드)**: 폭 축소(`sm:!max-w-xl`), 배경 블러 제거(Sheet·Dialog 오버레이 `backdrop-blur` 삭제). **시트 안 편집 가능하게** — 팝오버/셀렉트/드롭다운/컨텍스트 positioner `z-50`→`z-[70]`(시트 `z-[60]` 뒤로 숨던 문제). 시트 안에서 **다른 티켓 링크 → 새 탭**(`useInSheet` + `target=_blank`, 시트 미덮음). **콘텐츠 폭 채움** — 재사용 상세 루트의 `mx-auto` 가 flex-col 시트에서 콘텐츠를 축소시켜 우측 쏠림 → `[&>div]:w-full` 로 채움. [gotchas §21]
- **대시보드 "최근 활동" 개인화**: 전역 피드 → 나와 관련된 것만(내가 담당/보고자인 태스크·오너 에픽·작성 위키의 활동 + 나를 멘션한 알림). 멘션 `Notification`(type mention)을 활동 항목으로 정규화(`activityDescription` 에 `mentioned` 케이스). `getDashboardData(userId)` 로 시그니처 변경.
- **팀 페이지**: 멤버 배정을 **관리자(ADMIN) 전용**(UI 노출 + `setUserTeam` 서버 가드). 멤버 이름/아바타 클릭 → **중앙 팝업(`UserPreviewDialog`)** 으로 요약(역할·연락처·담당/오너 수 + 전체 프로필 링크), 열릴 때 `getUserPreview` 지연 로드.
- **공용 테이블** 첫 열 좌측 패딩(`ui/table` `first:pl-4`).
- **운영**: 역할 변경 UI가 없어 `koosco136@gmail.com` 을 스크립트로 `role=ADMIN` 부여(멤버별 role은 `User.role`, 게이트는 `lib/authz`; 변경 UI는 미구현).
- **함정(신규)**: [gotchas §21](상세 시트 상호작용 — 팝업 z-index·재사용 상세 mx-auto 축소·블러), [gotchas §22](목록 정렬 고유 tiebreaker).

---

## 2026-07-09 — 추정 단위 MD 일원화 · 목록/상세/타임라인 UX 개선 · 리뷰 상태 제거

커밋 `0984416`. 사용자 피드백 다수를 한 세션에 반영. 검증: tsc 0 · vitest 106 pass · eslint clean. DB 스키마 변경 2건 포함(마이그레이션) — 타 환경은 `prisma migrate deploy` 필요.

- **추정 단위 SP→MD 일원화**: `Task.storyPoints`(Int) 컬럼 **DROP**(마이그레이션 `20260709130000_drop_task_story_points`). 추정은 `estimatedMd`/`actualMd`(Float 소수)만. 목록 표의 "SP" 열을 MD(=`estimatedMd`)로 교체, 에픽 롤업(`getEpics`)·스프린트 합(`getSprints` raw 집계로 Task→Epic→Project→Sprint MD 합)도 MD 기준. 폼·상세·검증(`validators`)·활동라벨·seed·테스트에서 storyPoints 제거. 태스크 MD 변경 시 `epics`·`sprints` 캐시 태그도 무효화. [gotchas §20]
- **리뷰(IN_REVIEW) 상태 제거**: `Status` enum 에서 삭제(마이그레이션 `20260709120000_remove_in_review_status` — Postgres enum 값 제거 불가라 타입 재생성 + 기존 IN_REVIEW 행 BACKLOG 이관). constants/validators/kanban/seed/design-system 전 참조 정리. 상태는 4개(BACKLOG/TODO/IN_PROGRESS/DONE).
- **목록 표(tasks/epics/projects)**: ① 컬럼 순서 우선순위→상태. ② **행 전체 클릭 → 우측 슬라이드 상세**(`RowOpenSheet`, 편집 컨트롤·↗ 는 인터랙티브 가드로 제외). ③ 제목 **클릭-투-에딧**(`InlineTitle` — 글자=편집, 우측 빈공간=상세 링크). ④ 정렬 헤더 **3단계 토글**(내림→오름→정렬없음, `SortableHead`). ⑤ MD 인라인 **직접 입력**(number 스피너 제거 → `inputMode=decimal` + `field-sizing:content` 좌측정렬). ⑥ 프로젝트 레이블 열 좌측정렬, MD·담당자 열 간격. [gotchas §12·§20]
- **상세 시트**: ① 뷰포트 `lg:grid-cols-3` → **컨테이너 쿼리**(`@container/detail` + `@3xl/detail:*`)로 전환 → 좁은 시트 3열 겹침 해결. ② 인터셉트 본문을 `<Suspense fallback={<DetailSkeleton/>}>` 로 **스트리밍** → 목록 유지 + 시트만 슬라이드(전체화면 loading 플래시 제거). ③ `<main>` `scrollbar-gutter:stable` → 시트 열릴 때 좌우 밀림 방지. [gotchas §19]
- **타임라인**: 프로젝트→**담당자별 그룹**(좌측 이름/아바타) + 그룹 간격, 날짜축 **2줄(월+모든 일자)**, 의미없는 회색 세로줄(그리드·주말 음영) 제거, **에픽=옅은 회색·태스크=짙은 회색** 구분, 바 라벨 sticky(가로 스크롤 시 보이는 좌측에 고정, 좌측 잘림 패딩).
- **기타**: 위키 수정 버튼 헤더→제목 행 우측 이동(편집은 저장 버튼으로만), 유저 메뉴 `DropdownMenuItem nativeButton` 경고 수정, 예상/실제 MD 툴팁(`FieldHint`, 1md=8h).
- **함정(신규 발견)**: 인터셉트 대상 경로를 `router.prefetch` 하면 `Invalid interception route` 로 인터셉트가 깨져 전체 페이지로 폴백 → `RowOpenSheet` 에서 prefetch 제거. [gotchas §12]

---

## 2026-07-09 — 위키 리치 렌더링(표·코드 구문강조·mermaid)

위키 상세에서 표·코드블록(구문강조)·mermaid 다이어그램 렌더링 추가. 확장을 `wikiExtensions()` 한 곳에 등록해 에디터·읽기전용 뷰(WikiView·WikiCommentsView)가 자동 공유.

- **의존성 추가(main 직접 설치)**: `@tiptap/extension-table`(TableKit)·`@tiptap/extension-code-block-lowlight`·`lowlight`·`mermaid`.
- **표**: `TableKit.configure({ table: { resizable: true } })`. 툴바에 표 버튼(Popover 메뉴 — 삽입 3×3, 행/열 추가·삭제, 헤더 토글, 표 삭제). CSS 는 hairline 보더 + header row 인셋 배경(surface ladder 정합) + `.tableWrapper` 가로스크롤.
- **코드 구문강조**: StarterKit 기본 CodeBlock 을 끄고(`codeBlock: false`) `CodeBlockLowlight`(lowlight `common` 언어셋)로 대체 — Link 를 끄는 것과 같은 중복확장 회피 패턴([gotchas §7]). `globals.css` 에 `.hljs-*` 라이트 팔레트 추가.
- **mermaid**: 커스텀 atom 노드 `MermaidBlock`(`mermaid-block.tsx`) + ReactNodeView. 소스를 `attrs.code` 에 저장, NodeView effect 에서 `mermaid` **동적 import**(무거운 번들 → mermaid 블록 있는 페이지에서만 로드, 별도 청크)해 `mermaid.render(고유id, code)` SVG 주입. `securityLevel:"strict"`. editor.isEditable 로 편집(코드 textarea+실시간 미리보기) vs 뷰(다이어그램만) 분기. 툴바에 '다이어그램' 버튼(기본 flowchart 삽입). 문법 오류는 `.wiki-mermaid-error` 로 표시.
  - **함정**: 렌더마다 고유 id 필요(mermaid 임시노드 충돌 방지), setState 는 effect 본문 금지라 async 콜백 안에서만([gotchas §15]). 상세 [gotchas §18].
- **검색 커버리지**: `docToPlainText` 재귀라 **표 셀·코드블록 텍스트는 검색됨**(§16). mermaid 소스는 atom 이라 미검색(의도).
- **검증**: `tsc`·`eslint` clean, `vitest` **107/107**, `next build` 성공(mermaid 지연청크 분리 확인). **실렌더(표 리사이즈·강조·mermaid 다이어그램)는 로그인 게이트라 브라우저 확인 필요** — 코드/번들만 검증됨.

---

## 2026-07-09 — 에러/로딩 바운더리 + 태스크 의존성(blocks/blockedBy)

전역 개선 아이디어 중 사용자가 고른 2건. 견고성(에러/로딩) + 제품 기능(의존성).

- **라우트 에러/로딩 바운더리(견고성 갭)**: 앱 전체에 `error.tsx`·`loading.tsx` 가 0개였음 — 서버 액션/쿼리가 throw 하면 Next 기본 에러 화면, force-dynamic 이라 느린 로드 시 빈 화면. 신규 `(app)/error.tsx`(client, `reset()` 재시도 버튼 + `error.digest` 표기, 앱 셸 유지·본문만 교체) + `(app)/loading.tsx`(Skeleton 스켈레톤, `aria-busy`) + 루트 `global-error.tsx`(루트 레이아웃 자체 오류용 안전망 — 자체 `<html>/<body>`+인라인 스타일, CSS 로딩 보장 못 하므로). 콘솔/외부로그는 프로젝트 관례(console 0건) 지켜 미도입, 리포팅 훅 위치만 주석으로 표시.
- **태스크 의존성(blocks/blockedBy)**: 스키마·UI 전무였음(PM 툴 핵심 기능). `TaskDependency`(blocker→blocked 방향 엣지, `@@id([blockerId,blockedId])`, 태스크 삭제 시 cascade, `@@index([blockedId])`) additive 추가(마이그레이션 `20260709080738_task_dependency`). 서버 액션 `addTaskDependency`/`removeTaskDependency`(tasks.ts): 존재 확인·자기참조 거부·**순환 방지**(전체 엣지 로드 후 `wouldCreateCycle`)·멱등 upsert/deleteMany. 순환 판정은 순수 헬퍼 `lib/task-deps.ts`(dependsOn 방향 그래프 도달성 DFS)로 분리 → 유닛 8건. `getTask` 에 `blockedBy`(나를 막는 blocker)·`blocking`(내가 막는 blocked) include. UI `detail/task-dependencies.tsx`(client, `LinkSearchPopover`+`searchTasksAction` 재사용, 두 방향 리스트, 미완료 blocker 수 '차단됨' 배지) → 태스크 상세 사이드바 카드. 인터셉트 상세(@detail)도 같은 `[id]/page` 재사용이라 자동 반영.
- **활동 로그 미기록(의도)**: 의존성 add/remove 는 관계 변경이라 `linkTaskToPage` 등 기존 링크 액션과 동일하게 Activity 미기록(activity-format 무변경).
- **검증(E2E)**: 실 DB 에서 A→B 생성 → B.blockedBy 에 blocker(#2, IN_PROGRESS) 정확 표시, B→A 역방향은 `wouldCreateCycle`=true 로 차단 확인. 순환 방지 유닛 8건(자기참조·직접/전이 역방향·다이아몬드·팬아웃) green.
- **후속(같은 세션) 완료**: (1) **보드/목록 '차단됨' 배지** — `getBoardTasks`/`getTasks` 가 `blockedBy` 상태만 로드해 `blocked`(미완료 blocker 존재) 계산 후 반환(`blockedBy` 는 strip), `BlockedBadge`(badges.tsx, Ban 아이콘·destructive 틴트) 를 칸반 카드·태스크 표 제목 옆에 노출. 캐시 무효화는 의존성 액션이 이미 `bumpTags(tasks)` 하므로 자동. (2) **의존성 Activity 기록** — `add/removeTaskDependency` 가 양쪽 태스크에 `dependency_added`/`dependency_removed` 로그(meta: 상대 key·title·role), `activity-format.activityDescription` + `history-panel` 에 렌더 케이스 추가. remove 는 실제 삭제(count>0) 시에만 기록. 유닛 2건 추가 → **107 green**. 배지 계산 실 DB 검증(blocker IN_PROGRESS → blocked=true).

검증: `tsc`·`eslint` clean, `vitest` **105/105**(task-deps 8건 추가). 상세 함정은 [gotchas §17].

---

## 2026-07-09 — 위키 본문 전문검색(D10) + 백로그 문서 현행화

전역 개선 착수 전 코드 감사에서 드러난 것: 코드베이스가 매우 건강함(tsc·eslint clean, 빈 catch·`console`·`any`·실제 코드 TODO 0, 모든 액션 `requireUser`). **선택했던 개선 후보 중 상당수가 이미 닫혀 있었음** — D7(에픽 라벨)·D8(WikiView content 동기화)은 이미 구현·배선 완료였는데 roadmap 상태만 `TODO` 로 stale, D1 의 인프라 불요 부분(순수 헬퍼 유닛)도 이미 완료. 실제로 남은 명확한 갭은 **위키 본문검색**(C7 한계)뿐이라 이것만 구현.

- **위키 본문 전문검색(D10, C7 확장)**: ⌘K 전역 검색이 위키를 제목만 매칭하던 한계 해소. 본문이 Tiptap 리치 JSON(`content Json`)이라 SQL `contains` 불가 → **denormalized 순수 텍스트 사본** `WikiPage.searchText String?`(additive 마이그레이션 `20260709075321_wiki_search_text`) 추가. 본문 변경 액션 3곳(`createWikiPage`=빈 문자열, `updateWikiContent`, `restoreWikiRevision`)에서 `docToPlainText(content)` 로 채움(`renameWikiPage` 는 제목만이라 제외). `globalSearch` 위키 where 를 `OR:[{title},{searchText}]` 로 확장(휴지통 `deletedAt:null` 유지), 제목 미매칭·본문 매칭 시 결과 `subtitle` 에 `searchExcerpt`(신규 순수 헬퍼) 발췌 표시 — 커맨드 팔레트는 `subtitle` 을 이미 공통 렌더.
- **기존 페이지 백필**: `prisma/backfill-wiki-search.ts`(미백필=`searchText:null` 만 대상, idempotent) 1회 실행 → 7페이지 반영. tsx 가 `@/` alias 미해석이라 `docToPlainText` 로직을 스크립트에 인라인 복제(원본 변경 시 동기화 필요 — 주석 명시).
- **검증(E2E)**: 실 DB 에서 본문 토큰 "개요"(제목 "브랜드 캠페인 위키" 에 없음)로 OR 검색 → 해당 페이지 1건 반환 확인.
- **테스트**: `searchExcerpt` 유닛 8건 추가(대소문자·앞뒤 말줄임·공백 단일화·빈입력·미매칭 폴백) → 총 **97 green**.
- **문서 현행화**: D7·D8 을 `DONE`(이미 구현)으로 정정 + D10 신규 항목 + [gotchas §16](./gotchas.md)(searchText 동기화·백필·인덱스 미도입 배경) 추가. **교훈: 착수 전 코드로 현행 확인**(문서 stale 주의).
- **인덱스 미도입(의도)**: `contains` 는 btree 미활용이나 위키 규모 작아 순차 스캔 충분 → GIN pg_trgm 미도입. 트래픽 커지면 tsvector FTS 로 승급.

검증: `tsc`·`eslint` clean, `vitest` **97/97**.

---

## 2026-07-09 — 반응형 개선(특히 위키)

기존 앱 셸·테이블(overflow-x)·보드(가로 스크롤)·상세(lg:grid-cols-3)·대시보드/팀(반응형 그리드)·다이얼로그(`max-w-[calc(100%-2rem)] sm:max-w-sm`)는 이미 반응형이라, 남은 갭만 보강. 스키마 변경 0건.

- **위키 사이드바 모바일 접근(핵심 갭)**: 좌측 사이드바(즐겨찾기·페이지 트리·휴지통)가 `hidden md:block` 이라 **모바일에선 문서 탐색·페이지 전환이 아예 불가**했음. 신규 `wiki-nav-sheet.tsx`(client) — 모바일 전용 "문서 트리" 버튼이 좌측 Sheet 드로어로 같은 nav 를 연다(앱 셸 모바일 메뉴 패턴과 통일). 경로 변경 시 자동 닫힘은 effect/ref 금지(react-hooks 규칙) 때문에 **이전 경로를 state 로 둔 derive-during-render** 로 처리. `wiki/layout.tsx` 가 nav 를 변수로 추출해 데스크톱 aside + 모바일 드로어가 공유.
- **위키 인라인 댓글 뷰 모바일 붕괴 수정**: `wiki-comments-view.tsx` 가 댓글 있으면 본문에 `padding-right: 296px` 를 강제하고 카드를 `absolute right-0 w-72`(288px)로 배치 → 모바일(~320px)에선 **본문이 ~24px 로 뭉개짐**. `useSyncExternalStore`(하이드레이션 안전, setState-in-effect 회피)로 `(min-width:768px)` 감지 → **md+ 는 기존 마진노트, 모바일은 거터 제거·전체폭 본문 + 댓글을 본문 아래 일반 흐름으로 스택**. 브레이크포인트 교차 시 layout 재계산.
- **위키 버전 기록 다이얼로그**: 좌우 분할 `grid-cols-[15rem_1fr]`(모바일에서 미리보기 ~60px)를 `grid-cols-1 grid-rows-[10rem_1fr] sm:grid-cols-[15rem_1fr] sm:grid-rows-1` 로 — 모바일은 목록 위/미리보기 아래 상하 스택.
- **폼 다이얼로그 2열 그리드**: sprint/project/epic/task 폼의 `grid grid-cols-2 gap-3`(반응형 없음, 좁은 폰에서 날짜/셀렉트 협소) → `grid-cols-1 gap-3 sm:grid-cols-2`.
- **태스크 필터 검색창**: `w-52` 고정 → `w-full sm:w-52`(모바일 전체폭, 셀렉트는 아래로 wrap).

검증: `tsc`·`eslint` clean, `vitest` 89/89, `next build` 성공.

---

## 2026-07-09 — 백로그 D3(데이터 캐시)·D9(a11y 점검) 마무리

[roadmap-v2 그룹 D](./roadmap-v2.md)의 남은 실행 가능 항목 2건. 스키마 변경 0건.

- **D3 데이터 레이어 캐싱(force-dynamic 유지, 순수 additive)**: 공유(비유저 종속) 목록/옵션/트리 쿼리 14개(`getTeams`/`getTeamOptions`/`getSprints`/`getSprintOptions`/`getProjects`/`getProjectOptions`/`getEpics`/`getEpicOptions`/`getBoardTasks`/`getTasks`/`getLabels`/`getLabelOptions`/`getWikiTree`/`getWikiFolders`)를 `unstable_cache` 로 래핑(엔티티별 태그 + 시간 백스톱). 페이지는 `requireUser`(쿠키)로 어차피 동적이라 **라우트 캐시는 안 건드리고 DB 조회만** 요청 간 공유 → 폼/목록 로드마다 반복되던 옵션·롤업 쿼리 부하 감소. 각 mutating 액션에 `revalidateTag`(`bumpTags` 헬퍼)를 기존 `revalidatePath` 와 **함께** 배선하되 **교차 엔티티 표시 의존성**을 반영(예: team 변경 → `epics`/`tasks`/`projects` 도 무효화, label 변경 → 3개 목록 + `labels`, epic 변경 → `tasks`(제목 표시)·`projects`(카운트)). 유저별/검색/상세 쿼리는 캐시 제외(정합성 리스크·저가치). **Next 16 함정**: `revalidateTag` 두 번째 인자 필수 + 기본 `"max"` 는 stale-first라, 편집 즉시 반영 위해 `{ expire: 0 }` 사용([gotchas §13](./gotchas.md)). `use cache` 는 `cacheComponents` 플래그 미설정이라 미채택.
- **D9 a11y 전수 점검**: 아이콘 전용 인터랙티브 요소의 접근 가능한 이름 갭 2건 수정 — 앱 셸 모바일 메뉴 버튼(`layout.tsx`, `<Menu/>` 만) `aria-label="메뉴 열기"`, 위키 에디터 툴바 13개(`editor.tsx` `Btn`) `aria-label`(굵게/기울임/제목1~3/목록/체크리스트/인용/코드/실행취소/다시실행) + `title`·`aria-pressed`. `Button` 프리미티브는 focus-visible ring 내장이라 포커스 링 문제 없음, calendar nav 는 react-day-picker 가 라벨 제공. 나머지(⋯메뉴·닫기·색상칩·연결해제 등)는 이미 커버돼 있어 변경 없음([gotchas §14](./gotchas.md)).
- **미실행(의도적)**: D1 통합/E2E(테스트 DB·SSO 우회 인프라 선결), D3의 고빈도 엔티티 목록까지의 전면 확대는 로드맵 방침("무리한 리라이트 지양")대로 안전 부분집합만, D4 SSE 는 백로그 유지.

검증: `tsc`·`eslint` clean, `vitest` **89/89**, `next build` Compiled successfully(페이지는 의도대로 `ƒ` 동적 유지 — 데이터 캐시가 그 아래서 동작).

---

## 2026-07-09 — 위키 저장 반영·목록 개편(인라인 편집+슬라이드 상세)·프로필 메뉴 크래시

라이브 피드백 배치. 스키마 변경 0건(기존 컬럼/관계만 활용).

- **위키 저장 후 즉시 반영**: cmd+Enter 저장 → 뷰 전환 시 새 본문이 새로고침 전엔 안 보이던 버그. 읽기 뷰(`WikiCommentsView`)의 Tiptap `useEditor` 는 최초 `content` 만 반영하고 이후 prop 변경엔 반응 안 함(뷰 셸이 이미 마운트돼 있어 `router.refresh()` 후에도 옛 본문 유지). → `content` 가 바뀌면 `editor.commands.setContent(...)` 로 직접 동기화(effect). [gotchas §10]
- **위키 긴 글 하단 여백**: `main`(overflow-y-auto)의 `pb`는 스크롤 컨테이너 자기 하단 패딩이라 overflow 끝에서 무시될 수 있음(WebKit) → "연결된 티켓"이 바닥에 딱 붙음. 여백을 **스크롤 높이에 포함되는 자식 블록**(`wiki/[id]/page.tsx` 루트 `pb-16`)으로 이동. [gotchas §11]
- **Epic/Task/Project 목록 컬럼 재정렬**: Task/Epic = `키·제목·우선순위·StoryPoint·담당자아바타·상태`, Project = `제목·상태·담당자·기한·우선순위·레이블·생성시간·수정시간`(프로젝트는 이슈 key·댓글 없음 → 제외). Epic StoryPoint 는 자체 필드가 없어 **하위 태스크 합 rollup(읽기전용)** — `getEpics` 에 `task.groupBy(_sum.storyPoints)` 추가. `getProjects` 에 `labels` include 추가(표시전용).
- **목록 셀 인라인 편집**: 상세용 `detail/inline-fields`(`InlineStatus/Priority/Member/Date/Number/Title`)를 표 셀에 재사용(`edit` 컨텍스트 있을 때만; 상세 하위목록은 읽기전용). 행 전체 링크(`TableRowLink`)를 **제거**해 셀 편집과의 클릭 충돌 해소 → 키 셀만 상세 트리거. `InlineTitle` 에 `className` 추가(셀용 compact).
- **우측 슬라이드 상세**: intercepting + parallel routes 로 **기존 상세 페이지를 그대로 재사용**. 각 목록 세그먼트에 `layout.tsx`(`@detail` 슬롯)+`@detail/default.tsx`(null)+`@detail/(.)[id]/page.tsx`(전체 상세 `[id]/page` 를 `DetailSheet` 로 감쌈). key/열기 클릭=우측 슬라이드(soft-nav 인터셉트, z 좌측 사이드바 위), ↗ 버튼=`target=_blank` 전체 페이지(하드 로드=인터셉트 안 됨). 목록 세그먼트 한정. [gotchas §12]
- **헤더 프로필 메뉴 크래시**: 아바타 클릭 시 `Base UI: MenuGroupContext is missing` 로 드롭다운 크래시. `UserMenu` 의 `DropdownMenuLabel`(=Base UI `Menu.GroupLabel`)이 `Menu.Group` 밖에 있었음 → `DropdownMenuGroup` 으로 감쌈. **gotchas §4 에 이미 명시된 함정이 실제로 재발**. [gotchas §4]

검증: `tsc`·`eslint` clean, `vitest run` 73/73, `next build` 성공(인터셉트 라우트 `/tasks|epics|projects/(.)[id]` 등록 확인). dev 브라우저 실검증 — 태스크 목록 새 컬럼+인라인 편집 렌더, ⌘K로 태스크 클릭 시 우측 슬라이드 상세(전체 상세 재사용)·↗ 새 탭, 개인 프로필 페이지 정상, 프로필 드롭다운 정상 오픈(수정 후). 원격 `Team-Neki/Team-Neki-Sprint` main 푸시.

---

## 2026-07-09 — 전체 감사 개선 P1~P4(그룹 D)

[roadmap-v2 그룹 D](./roadmap-v2.md) 순차 진행. 스키마 변경 0건.

- **P1-1 테스트 확대(D1)**: 순수/준순수 헬퍼 유닛 +16 → **89 pass**. `keys`(nextTeamNumber 원자 계약, fake tx)·`activity`(diffFields)·`mentions`(extractMentionUserIds)·`authz`(canManage). 통합/E2E는 테스트 DB·SSO 우회 인프라 필요라 잔여(D1 백로그).
- **P1-2 삭제 인가(D2)**: `lib/authz`(`canManage`/`assertCanManage`). 편집은 개방 유지, **파괴적 삭제만** 소유자/작성자 또는 ADMIN 으로 제한 — task(reporter·assignee)/epic·project(owner)/wiki(author) delete·purge 게이트. `ConfirmDelete` 가 throw 를 toast 처리.
- **P2(D3·D4) 의도적 보류**: force-dynamic→태그 캐싱 전면 전환, 폴링→SSE 는 정합성 리스크·인프라 대비 즉시 가치 낮아 **백로그 유지**(무리한 리라이트 지양).
- **P3-5 에러 핸들링(D5)**: 검토 결과 폼·댓글·인라인 편집 등 사용자 대면 실패는 **이미 일관되게 toast** 처리 중 → 변경 불필요(의도적 무시=draft 자동저장·logActivity 만). 프리미스 해소.
- **P3-6 입력 검증(D6)**: 태스크 댓글 `addComment` 에 `taskCommentBodySchema`(크기 상한) 적용(위키 댓글은 기존에 이미 검증).
- **P4-7 에픽 라벨(D7)**: `addLabelToEpic`/`removeLabelFromEpic` + `getEpic` labels include + `EpicLabels`(공용 `EntityLabels` 래퍼) → 에픽 상세 라벨 부여.
- **P4-8 WikiView 동기화(D8)**: 버전 미리보기 읽기전용 뷰도 content prop 변경 시 `setContent` (gotchas §10 동일 패턴).
- **P4-9(D9)**: 목록 담당자 인라인 편집 트리거를 **아바타-only**(이름→아바타, 툴팁에 이름)로. 프로젝트 목록 **컬럼 정렬**(`?sort=&dir=` URL 기반 `SortableHead` + `getProjects` orderBy; 하위목록은 일반 헤더). a11y 전수 점검만 잔여.

검증: `tsc`·`eslint` clean, `vitest` **89/89**, `next build` 성공. dev 브라우저 — 프로젝트 정렬 헤더(6개)·아바타 트리거·라벨 편집기 렌더, 프로젝트/에픽 라벨 attach/detach DB 경로 확인. 원격 main 푸시.

---

## 2026-07-09 — 후속: 개선 5건(죽은 코드·MD 쿼리 정리, 하위목록 행 클릭, 시트 BackButton, 프로젝트 라벨)

앞 세션 산출물 점검 후 개선.

- **죽은 코드 정리**: 미사용이 된 `tables/cells.tsx`의 `KeyCell`·`MdCell` 제거(→ `CountCell`·`EmptyRow`만 유지, sprints-table 전용), `tables/row-action-cell.tsx` 삭제(행별 연필 편집 제거로 미사용).
- **버려지던 MD 롤업 쿼리 제거**: 목록 표가 MD 컬럼을 안 쓰는데 `getEpics`/`getProjects`/`getSprint`가 매 로드마다 MD 합계를 계산·부착했음 → 제거(불필요 DB 부하 감소). `mdByProject` 정의도 미사용이라 삭제. 상세 페이지 rollup(`getEpic`/`getProject`)은 유지.
- **하위목록 행 클릭 회기 복원**: 인라인 편집 충돌로 행 전체 링크(`TableRowLink`)를 뺀 뒤, 상세 하위목록(읽기전용)에서 클릭 영역이 키 셀로 축소됐던 문제 → **읽기전용 모드에서 제목을 `Link`로** 만들어 클릭 영역 회복(목록 편집 모드는 인라인 편집 유지).
- **슬라이드 상세 BackButton 숨김**: 시트 안에서 "보드/에픽으로" 뒤로가기(닫기 X와 중복·라벨 오해)를 숨김. `InSheetProvider`(client context)로 `DetailSheet` 자식을 감싸고 `BackButton`이 `useInSheet()`로 감지해 시트 안에서만 `null` 반환(전체 페이지에선 그대로 노출). 서버 렌더 상세 자식을 client provider가 감싸도 context가 전파됨을 라이브 확인.
- **프로젝트 라벨 편집 구현**: `addLabelToProject`/`removeLabelFromProject` 액션 추가. `TaskLabels` 로직을 공용 `detail/entity-labels.tsx`(`EntityLabels`, attach/detach 주입형)로 추출 → `TaskLabels`·신규 `ProjectLabels`가 얇은 래퍼. 프로젝트 목록 레이블 컬럼이 편집 가능(부여/해제/즉석 생성). `projects/page` 가 `getLabelOptions` 를 edit 컨텍스트로 전달.

검증: `tsc`·`eslint` clean, `vitest` 73/73, `next build` 성공. dev 브라우저 — 태스크 목록→⌘K 소프트내비 슬라이드 상세에 **BackButton 없음**·전체 페이지엔 **있음** 확인, 프로젝트 표 새 컬럼+라벨 편집기 렌더 확인, 프로젝트 라벨 attach/detach DB 경로(복합키 `projectId_labelId` upsert) 스크립트로 확인 후 정리. 원격 main 푸시.

---

## 2026-07-08 — 로드맵 v2 백로그 8건 전부 구현 (git worktree 병렬)

Phase 1~4 종료 후 새로 도출한 [roadmap-v2](./roadmap-v2.md) 8건을 git worktree 병렬 + 순차 병합으로 전부 구현. 스키마 변경 0건(전부 기존 스키마/컬럼 활용) → 마이그레이션·dev서버 재시작 없이 진행. 각 파 병합 후 main에서 통합 `tsc`+`eslint`+`next build` 통과.

- **파1(A4·B6·A2·A3, 4 worktree 병렬)**: A4 ItemRow hover no-op→ring. B6 eslint `.worktrees/**` ignore. A2 보드 재정렬 정합성 — `reorderBoardTask`를 대상 컬럼 전체 로드→숨은 태스크 앵커링→전체 재번호(필터 뷰에서 숨은 태스크 순서 안 깨지게). A3 위키 인라인 댓글 앵커 저장에 `updatedAt` 낙관적 동시성 가드(불일치 시 conflict 반환·클라 새로고침, 스키마 없이).
- **파2(A1·C7, 2 worktree 병렬)**: A1 알림 벨 클라 폴링(45s `setInterval` + 팝오버 열 때 재조회, `getBellNotifications` 액션). C7 전역 검색/⌘K — `queries.globalSearch`(5개 엔티티 그룹, 위키 `deletedAt:null` 필수) + Base UI Dialog 커맨드 팔레트(전역 키다운·디바운스·키보드 내비), 토픽바 마운트.
- **파3(C8 worktree + B5 main 병렬)**: C8 Label 기능화(접근안 a, 비파괴) — 데드 스키마였던 Label을 태스크 CRUD·부여 팝오버·`?label=` 필터·색 뱃지·`/labels` 관리 페이지로 표면화(에픽/프로젝트 부여는 후속). B5 Vitest 도입 + 순수 로직 유닛 **73건**(validators `.nullish`·rich-content·constants·activity-format) green. **B5는 deps 추가라 worktree symlink 함정(gotchas §2) 회피 위해 main에서 직접** 설치·작성.

검증: 파별 병합 후 `tsc`·`eslint` clean, `next build` Compiled successfully(라벨 라우트 포함), `vitest run` 73/73 pass. 함정: A2 서브에이전트가 센티넬로 NUL 문자(`" "`)를 써서 git이 파일을 바이너리로 인식 → 병합 전 발견·안전 문자열로 교체([gotchas §9](./gotchas.md)).

---

## 2026-07-08 — 후속: 목록에서 행별 수정 + 카운트 컬럼 제거

- **프로젝트·에픽·태스크 목록에서 행별 수정**: 각 표(공용 `tables/*`)에 optional `edit` 컨텍스트(옵션 목록) 추가 → 우측에 수정(연필) 액션 컬럼. 클릭 시 **기존 생성 다이얼로그를 편집 모드**로 연다(`project`/`epic`/`task` prop). 목록 쿼리가 `include` 라 편집에 필요한 스칼라(description·ownerId·teamId·날짜·포인트·MD)가 이미 로드돼 있어, 행 타입만 넓혀(대부분 optional, teamId 는 required) Existing 을 구성. 상세 하위목록은 `edit` 미전달이라 액션 컬럼 없음(그대로).
- **RSC 경계**: 표는 서버 컴포넌트라 `TableCell` 에 `onClick`(행 이동 전파 차단용 stopPropagation)을 직접 못 준다 → client 래퍼 `row-action-cell.tsx`(`RowActionCell`)로 분리. gotchas 참고.
- **카운트 컬럼 제거**: 프로젝트 표의 '에픽' 수 · 에픽 표의 '태스크' 수 컬럼 삭제(목록에서 의미 없음). `CountCell` 은 미사용으로 남김.

검증: `tsc`·`eslint` clean, dev 브라우저 — 프로젝트/에픽 목록에서 카운트 컬럼 사라짐 확인, 연필 클릭 시 '프로젝트 수정' 다이얼로그가 기존값(제목·설명·스프린트·상태·담당자·날짜) 프리셋으로 열리고 **행 이동 안 함**(stopPropagation) 확인, 태스크 목록도 연필 노출.

---

## 2026-07-08 — 후속: 보드 컬럼별 추가 버튼 + 사이드바 우클릭 추가

라이브 피드백 2건.

- **보드 컬럼별 '추가하기' 버튼**: 칸반 각 컬럼 하단에 상태별 `+ {상태} 추가하기`(예: "+ 백로그 추가하기", "+ 할 일 추가하기") 버튼 추가. 클릭 시 **기존 `TaskDialog` 를 `defaultStatus={status}` 로 프리셋**해서 연다(팀 필수라 전용 폼 재사용이 안전 — 크로스팀 보드). 팀 필터(`?team=`) 활성 시 `defaultTeamId` 로 팀도 프리셋. → `board/page.tsx` 가 `createCtx`(members/teams/epics/defaultTeamId) 를 `KanbanBoard`→`Column` 으로 전달, 컬럼 droppable 하단 `mt-auto` 버튼. 드래그와 무관(버튼은 sortable 아님, pointer distance 6 활성화).
- **사이드바 빈 공간 추가 = 우클릭**: 위키 좌측 트리 빈 공간 추가 메뉴를 좌클릭 드롭다운 → **우클릭 컨텍스트 메뉴**(ContextMenu)로 변경(트리 항목 우클릭 메뉴와 통일). → `page-tree.tsx`.

검증: `tsc`·`eslint` clean, `next build` 성공. dev 브라우저 실검증 — 보드 5개 컬럼 하단 버튼 렌더, "+ 백로그 추가하기" 클릭 시 다이얼로그 상태=백로그 프리셋 확인; 사이드바 빈 공간 우클릭 시 "새 페이지/폴더 추가" 컨텍스트 메뉴. (dnd-kit 의 `DndDescribedBy` SSR 하이드레이션 경고는 선재 — 이번 변경과 무관.)

---

## 2026-07-08 — P4 위키 편집/휴지통/사이드바 개선 8건 (`feat/wiki-editor-trash-drafts`)

라이브 피드백 배치. 스키마 2건 additive(`wiki_drafts_and_trash`).

- **(1) 저장/취소 버튼 + 임시저장 2주**: 에디터 자동저장을 **명시적 '저장/취소' 버튼**으로 전환. 편집 중 변경은 디바운스로 **`WikiDraft`(유저×페이지 1건)** 에 자동저장(페이지 본문/리비전 아님). 이탈 후 재진입 시 draft 를 불러와 **편집 모드로 바로 진입** + "임시 저장본을 불러왔습니다" 배너("원본으로" 되돌리기). '저장'=`updateWikiContent` 커밋(리비전 생성)+draft 삭제, '취소'=draft 폐기+뷰 복귀. 보관 2주 — `getWikiDraft` 가 `updatedAt` 14일 초과 draft 를 만료 처리(null). → `WikiDraft` 모델, `editor.tsx` 재작성, `saveWikiDraft`/`discardWikiDraft` 액션.
- **(2) 댓글 여백 태그**: 인라인 댓글 앵커(commentMark) 위치를 본문 우측 여백에 **댓글 아이콘 태그**로 표시(드래그해 단 곳 식별). 앵커 span 의 `getBoundingClientRect` 로 top 계산(resize 재계산), 클릭 시 스레드 활성화. 해결된 스레드는 태그 생략. → `wiki-comments-view.tsx` `markTags`.
- **(3) 사이드바 빈 공간 클릭 → 추가 드롭다운**: 트리 아래 여백(`min-h-24` 트리거)을 눌러 새 페이지/폴더 추가. → `page-tree.tsx`.
- **(4) 편집 Cmd/Ctrl+Enter 저장**: 기존 Cmd+S 에 Cmd+Enter 저장 리스너 추가. → `editor.tsx`.
- **(5) 상세에서 폴더 정보 제거**: 상세 헤더의 폴더 이동 select 삭제(`page-folder-select.tsx` 제거, `movePageToFolder` 는 잔존).
- **(6) 즐겨찾기 좌측 상단 이동**: 우측 별도 패널 → **좌측 사이드바 '콘텐츠' 위**로. 별표 없으면 렌더 안 함. → `layout.tsx`(우측 aside 제거, 좌측 단일 컬럼 즐겨찾기→콘텐츠→휴지통), `favorites-panel.tsx`.
- **(7) 삭제 → 휴지통(soft-delete)**: `WikiPage.deletedAt`. `deleteWikiPage` 가 하드 삭제 대신 서브트리(자신+후손) `deletedAt` 세팅. 목록/트리/상세/즐겨찾기 쿼리는 `deletedAt: null` 필터. 확인 문구도 "휴지통으로 이동…복원 가능"으로. → `restoreWikiPage`/`purgeWikiPage` 신규.
- **(8) 휴지통 뷰**: 사이드바 '콘텐츠' 하위 **휴지통** 링크(항목 수 배지) → `/wiki/trash` 에서 삭제 문서 목록(삭제 루트만 노출) + 복원/영구삭제. → `trash-link.tsx`·`trash-list.tsx`·`wiki/trash/page.tsx`, `getTrashedWikiPages`.

검증: `next build` Compiled successfully, `tsc`·`eslint` clean. dev + DB 세션 주입 **브라우저 실검증** — (1) 편집 중 이탈→재진입 시 draft 배너+편집모드 복원, '취소'로 원복, (2) 댓글 생성 시 우측 여백 태그 렌더, (3) 빈 공간 드롭다운, (5) 폴더 select 사라짐, (6) 별표→좌측 상단 즐겨찾기 노출, (7) 삭제→트리에서 제거+휴지통 배지, (8) 휴지통 목록→복원→트리 복귀·휴지통 비움. 콘솔 에러 0. 테스트 데이터(별표·스레드·세션) 원복. 스키마 변경이라 dev 서버 재시작.

---

## 2026-07-08 — P4 B10 위키 인라인 댓글(구글독스식)

[roadmap B10]. 위키 본문에서 텍스트를 선택해 그 범위에 댓글을 달고(구글독스식), 스레드로 답글·해결·삭제까지. Phase 4 백로그의 마지막 미수행 항목.

- **스키마(additive, 마이그레이션 `wiki_inline_comments`)**: `WikiCommentThread`(pageId·`quote`=앵커 텍스트 스냅샷·`resolved`, page 삭제 시 cascade) + `WikiComment`(threadId·authorId·body, cascade). 기존 `Comment`는 태스크 전용이라 위키용 신설. `WikiPage.commentThreads`·`User.wikiComments` 역참조 추가. 리셋 아님.
- **앵커 = Tiptap 마크**: `comment-mark.ts`의 `CommentMark`(Mark, attr `threadId`) — 선택 범위에 `<span data-comment-thread class="wiki-comment-mark">` 하이라이트. `wikiExtensions()`에 추가해 **편집(WikiEditor)·뷰(WikiCommentsView)가 동일 스키마 공유**(마크가 문서 content JSON 에 저장되므로 양쪽이 같은 확장으로 파싱해야 안 어긋남). 커맨드 `setCommentThread(id)`(선택에 마크)·`unsetCommentThread(id)`(문서 순회하며 그 threadId 마크만 제거 — 다른 스레드 보존).
- **뷰 컴포넌트** `wiki-comments-view.tsx`: 읽기전용 Tiptap + 우측 코멘트 패널. `mouseup` 시 선택이 본문 안이면 `posAtDOM`으로 DOM 선택→PM 위치 매핑해 플로팅 '댓글' 버튼 표시. 생성 흐름 = `createWikiCommentThread`(스레드+첫 댓글, threadId 반환) → **잠깐 `setEditable(true)`로 켜서** `setTextSelection`+`setCommentThread` 마크 적용 → `getJSON` 순수 클론 → `saveWikiCommentAnchors`(content 만 저장, 리비전·알림 없이) → `router.refresh`. 앵커 span 클릭 ↔ 패널 카드 상호 `is-active`/스크롤, 해결 스레드 마크는 `is-resolved`(dim) 클래스로 동기화(effect가 `threads`/`activeId` 변화마다 DOM 재적용).
- **스레드 카드** `comment-thread-card.tsx`: 인용문 + 댓글 목록 + 답글 입력(Cmd/Ctrl+Enter) + 해결/재오픈·삭제. 답글 삭제는 본인·첫 댓글 제외. 서버액션 `wiki-comments.ts`(create/reply/resolve/deleteComment/deleteThread/saveAnchors). 삭제는 뷰에서 마크 strip 후 `saveWikiCommentAnchors`+`deleteWikiCommentThread`.
- **조회** `getWikiComments(pageId)`: 미해결 먼저·최신순, 댓글 시간순+author. `wiki/[id]/page.tsx`가 로드해 `WikiDetail`→뷰로 전달(`currentUserId` 포함). 뷰 모드는 기존 `WikiView`→`WikiCommentsView` 교체(편집 모드 WikiEditor 유지, 마크 공유로 하이라이트 렌더·보존).

검증: `next build` Compiled successfully, `tsc --noEmit`·`eslint` clean. 데이터층 스모크(스레드+첫 댓글 생성→답글→`getWikiComments` shape→resolve→cascade delete) 통과. dev + DB 세션 주입 **브라우저 실검증**: 텍스트 선택→플로팅 '댓글'→작성 시 앰버 하이라이트 부착·패널 스레드 생성, 답글 추가, **전체 리로드 후 앵커·댓글 persist**(마크가 content 에 저장됨 확인), 앵커 클릭 활성화, 해결→하이라이트 dim+해결됨 섹션 이동, 삭제→마크 strip+스레드 제거, 콘솔 에러 0. 테스트 세션·스레드 원복. 스키마 변경이라 dev 서버 재시작 필요.

---

## 2026-07-08 — P4 B6 리치 입력(설명·댓글 #티켓/@멘션)

[roadmap B6]. 설명·댓글의 plain textarea 를 Tiptap 리치 에디터로 교체해 위키와 동일한 `#` 티켓 링크·`@` 사람 멘션·마크다운 입력규칙을 얹었다. B5 멘션/알림 인프라 재사용.

- **저장 포맷(스키마 변경 없음)**: 설명(`description`)·댓글(`body`) 기존 `String @db.Text` 컬럼에 **Tiptap doc JSON 을 문자열로** 저장. 레거시 plain text 값은 읽을 때 `parseDoc` 이 단락 doc 으로 감싸 하위호환(마이그레이션 불필요). 서버 액션엔 `JSON.parse(JSON.stringify(getJSON()))` 순수 클론으로 전달(gotchas §7 RSC 직렬화).
- **공용 모듈**: `lib/rich-content.ts`(`parseDoc`/`docToPlainText`/`plainTextOf`/`isValueEmpty`/`mentionsInValue`), `components/rich-text/rich-editor.tsx`(`RichEditor` 편집 + `RichContent` 읽기전용, `wikiExtensions` 재사용, `.tiptap-compact` 로 최소높이·여백 축소), `server/notify.ts`(`notifyNewMentions` — before/after doc 의 멘션 차집합만 알림, 자기멘션 제외).
- **적용**: `InlineDescription`(상세 인라인, blur 시 baseline 대비 실변경만 저장), `comment-form.tsx`(Cmd/Ctrl+Enter 제출·제출 후 clear·빈 내용 비활성), 댓글 표시 `{c.body}` → `<RichContent>`. 알림: `addComment`(댓글 멘션)·`updateTaskFields`/`updateEpicFields`/`updateProjectFields`(설명 멘션) → `notifyNewMentions`. 히스토리(`activity-format`)는 설명 JSON 을 `plainTextOf` 로 발췌해 표시(raw JSON 노출 방지).
- **스코프**: 생성 다이얼로그의 설명 입력은 plain textarea 유지(빠른 생성 — 저장값은 폴백으로 상세에서 리치 편집 시 자동 JSON 승격). 댓글은 태스크 전용(Comment 모델이 taskId 만).

검증: `next build` Compiled successfully, `eslint` clean. dev + DB 세션 주입 브라우저 실검증 — 설명/댓글 에디터 렌더(플레이스홀더 `#티켓, @사람`), 댓글 `@jiwon` 드롭다운·선택·제출(POST 200) → **댓글 doc JSON+personMention 저장, jiwon 알림 생성(entityType task, context 태스크명)**, 댓글 읽기뷰 `@김지원` 링크블루 칩 렌더·제출 후 clear, 설명 blur 저장(doc JSON, POST 200). 테스트 데이터 원복.

---

## 2026-07-08 — P4 B5 프로필 · @멘션 · 알림 (+ 위키 저장 버그 수정)

[스펙 p3-03](./specs/p3-03-social-mentions-notifications.md) 기준. 사용자 프로필 라우트 + Tiptap `@` 사람 멘션 + 멘션→앱 내부 알림(벨·목록·읽음).

- **스키마(additive)**: `User.phone String?` + `Notification`(수신자 `userId`/행위자 `actorId`/`type`/`entityType`/`entityId`/`context`/`read`, `@@index([userId,read,createdAt])`). 마이그레이션 `notifications_profile`. seed 데모 4인에 phone 추가.
- **프로필 라우트** `users/[id]`: 아바타·이름·팀·역할 + 이메일/연락처(mailto/tel) + 담당 태스크(진행중)·오너 에픽 목록. `getUserProfile` 쿼리.
- **`@` 사람 멘션**: `person-mention.tsx`(`#` 티켓 멘션과 동일한 self-contained Tiptap suggestion 패턴, 트리거 `@`, `searchMembersAction` 검색 드롭다운, 인라인 `personMention` 칩 → `/users/<id>`). `extensions.ts` 에 한 줄 추가. 링크블루 위해 `globals.css @theme` 에 `--color-link` 매핑(`text-link`/`bg-link` 활성화).
- **멘션→알림**: `updateWikiContent` 저장 시 저장 전/후 doc 의 personMention userId 차집합(`lib/mentions.ts extractMentionUserIds`)만 → 수신자별 `Notification` 생성(자기멘션 제외, 재저장 중복 방지). 알림 벨 `notification-bell.tsx`(토픽바, unread 배지+Popover 최근10, 클릭→대상 이동+읽음), `/notifications` 전체목록 `notification-list.tsx`, 액션 `markNotificationRead`/`markAllNotificationsRead`. 레이아웃에서 `getNotifications`+`getUnreadNotificationCount` 로드.
- **부수 발견·수정 — 위키 저장이 B9 이후 깨져 있었음**: `updateWikiContent` 가 `editor.getJSON()` 을 서버 액션 인자로 그대로 넘겨 RSC 직렬화가 'temporary client reference' 로 취급 → 서버 `toStringTag` 접근 에러(POST 500, "저장 실패"). **`JSON.parse(JSON.stringify(getJSON()))` 순수 클론으로 수정**(editor.tsx). B9는 worktree 검증(dev 미구동)이라 라이브 저장을 못 잡았음. 겸사겸사 `Duplicate extension names ['link']` 경고도 `StarterKit.configure({ link: false })` 로 정리. 상세 [gotchas §7](./gotchas.md).

검증: `next build` Compiled successfully, `eslint` clean. dev 서버 + DB 세션 주입으로 브라우저 실검증 — 프로필 렌더, `@jiwon` 드롭다운(김지원·팀), 멘션 칩 삽입·저장(DB `personMention`+수신자 id), **저장 수정 후 POST 200**(이전 500), 멘션→jiwon 알림 생성(DB). 알림 벨/목록은 **서버 렌더(curl) 그라운드트루스로 확인**(배지 unread "1", 목록 "언급했어요")—브라우저 화면 stale 은 mcp 소프트내비 캐시 아티팩트. 테스트 데이터(리비전·알림·세션) 원복.

알려진 한계: `(app)` 레이아웃 벨은 소프트 내비게이션에서 갱신 안 됨(페이지 로드/`router.refresh` 시 갱신, 실시간 폴링 없음). 필터 무관.

---

## 2026-07-08 — P4 B7-board 칸반 순서 재정렬(DnD)

기존 칸반은 컬럼(상태) 간 이동만 가능하고 컬럼 안 순서는 `updatedAt desc` 고정이라 사용자가 우선순위대로 못 세우던 문제. 컬럼 내 재정렬 + 크로스컬럼 이동을 DnD로.

- **스키마(additive)**: `Task.boardOrder Float?`(마이그레이션 `task_board_order`, nullable 1컬럼, 리셋 아님). null=미정렬 → 컬럼 하단(nulls last).
- **kanban.tsx 재작성**: 기존 `useDraggable`/`useDroppable`(상태 변경만) → `@dnd-kit/sortable` **멀티컨테이너 패턴**. 로컬 상태를 `Record<Status,string[]>`(컬럼별 id 배열)로 관리, `onDragOver`가 다른 컬럼으로 넘어오면 즉시 이동(라이브 프리뷰), `onDragEnd`가 같은 컬럼은 `arrayMove`로 확정. 낙관적 업데이트 + 드래그 시작 스냅샷(`useRef`)으로 실패/취소 롤백. 서버 재동기화는 `id:status` 시퀀스 서명으로 순서 변화까지 감지(‘adjust state during render’ 패턴 유지).
- **서버액션 `reorderBoardTask(id, status, orderedIds)`**: 대상 컬럼 전체를 index 기준 재번호(`boardOrder=i`, 컬럼 작아 저렴), 옮겨온 태스크만 `status` 갱신, 상태가 실제 바뀐 경우에만 Activity(`status_changed`) 기록(B8 연동). 구 `moveTask`(kanban 유일 호출처) 대체·삭제.
- **createTask 하단 append**: 생성 시 해당 status 컬럼 `max(boardOrder)+1` 부여. `getBoardTasks` orderBy `updatedAt desc` → `[{boardOrder: asc, nulls: last}, {createdAt: asc}]`.
- **알려진 한계**: 담당자/팀 필터 활성 상태에서 재정렬하면 보이는 태스크만 재번호되어 숨은 태스크의 boardOrder와 간섭 가능(엣지, 후속 개선 여지).

검증: `next build` Compiled successfully, `eslint` clean. dev 서버 + DB 세션 주입 + **합성 pointer 이벤트**(pointerdown→move들→up)로 DnD 실제 구동: (1) TODO 컬럼 내 재정렬 → DB `boardOrder` 0/1 persist 확인, (2) 크로스컬럼(TODO→IN_REVIEW 빈 컬럼) → status=IN_REVIEW + boardOrder=0 + `status_changed` Activity 기록 확인. 테스트로 바꾼 데모 데이터는 원복. 스키마 변경이라 dev 서버 재시작 필요.

---

## 2026-07-08 — P4 B4 타임라인 좌측 컬럼 sticky

가로 스크롤 시 좌측 이름 컬럼이 눈금과 함께 떠내려가 어느 바가 어느 에픽/태스크인지 잃던 문제. `epic-timeline.tsx` 단일 파일 수정(스키마·데이터 무관).

- **이름 컬럼 고정**: 프로젝트 타이틀 `<p>`·에픽 이름 `div`·태스크 이름 `div`에 `sticky left-0 z-20` + 불투명 `bg-card`. 스크롤 시 이름 박스가 바 위로 올라와야 하므로 z-20으로 바(z auto)·그리드 오버레이(z auto)·today 마커(z-10)를 모두 덮음. 프로젝트 타이틀은 `w-64`(=NAME_W 256px)로 폭 제한해 거터만 마스크.
- **행 높이 전체 커버**: 행이 `flex items-center`라 이름 박스 높이가 콘텐츠 높이(<행 높이)로 잡혀 스크롤 시 바가 위아래로 삐져나옴 → 이름 박스에 `self-stretch` 추가해 행 전체 높이를 불투명 배경으로 덮음.
- **헤더 마스크**: 헤더를 `marginLeft:NAME_W`(눈금만) → **full-width**(`NAME_W+rulerWidth`)로 바꾸고 라벨 위치를 `NAME_W + index*dayWidth` 기준으로 이동. 좌측 거터에 `sticky left-0 z-30 bg-card` 마스크 블록을 둬 주간 라벨('2/1' 등)이 고정 이름 컬럼 아래로 새지 않게 함.

검증: `next build` Compiled successfully, `eslint` clean. dev 서버 + DB 세션 주입(Google SSO 우회)으로 브라우저 확인 — scrollLeft 최대 스크롤 상태에서 프로젝트/에픽/**펼친 태스크 하위행**까지 좌측 고정·흰 배경 클린, 그리드 음영은 256px 거터 우측(눈금 영역)에만, 헤더 코너 마스크 정상.

---

## 2026-07-08 — P4 상세 페이지 개편(B3 인라인 편집 + B7 MD + B8 히스토리)

[스펙](./specs/p4-detail-overhaul.md) 기준으로 프로젝트/에픽/태스크 상세를 인라인 편집 중심으로 재구성. `feat/detail-overhaul` 단독 스트림(상세·액션·쿼리 광범위 공유 → 내부 순차).

- **B3 인라인 편집**: 상세의 '수정' 다이얼로그 진입 제거 → 모든 필드를 상세에서 직접 편집. 레이아웃 3열 그리드 통일(좌=제목·설명·자식목록/댓글, 우=메타 카드). 상태를 우측 메타 카드로 이동, 태스크에 **담당자+보고자** 둘 다 인라인 편집(스키마에 `Task.reporterId` 편집 허용 추가). 신규 `components/detail/inline-fields.tsx`(제목/설명/상태/우선순위/멤버/링크/날짜/숫자, `OptionSelect` 칩 재사용, `useTransition`+`router.refresh`), 상단 단일 `property-bar.tsx` **삭제**(우측 카드로 흡수). 뒤로가기 하드코딩 `<Link>` → 재사용 `<BackButton fallback>`(`history.length>1`이면 `router.back()`).
- **B7 MD**: additive 스키마 `Task.estimatedMd/actualMd Float?`(마이그레이션 `task_md`, 2 nullable 컬럼, 리셋 아님). 편집은 태스크만(인라인 + 생성 다이얼로그). Epic MD=하위 태스크 합, Project MD=하위 에픽→태스크 합 — `queries.ts`에서 `groupBy`/집계로 **읽기전용 롤업**. 상세 메타 카드 + 에픽/프로젝트 목록에 `MdRollupText`("예상 X / 실제 Y MD"). `taskSchema`에 `estimatedMd`/`actualMd`(`optionalMd` = ""/null→null, 그 외 coerce≥0).
- **B8 업무 히스토리**: 기존 `Activity` 모델 활용(신규 스키마 없음). 인라인 편집을 **엔티티별 generic diff 로거** `updateTaskFields/updateEpicFields/updateProjectFields`로 통합 — 현재 값 로드 → 바뀐 필드만 update → 필드별 `field_changed` + `meta:{field,from,to}` 기록(`activity.ts`의 `diffFields` 헬퍼, Date→ISO 정규화·no-op 스킵). 팀/번호는 patch에서 제외(불변). 조회 `getEntityActivity(entityType,entityId)`. 신규 `components/detail/history-panel.tsx`가 한국어 문장("X님이 기한을 A→B 로 변경")으로 렌더(관계 필드는 전달된 목록으로 이름 해석). 구 `set*Status/Priority/Assignee/Owner` 경량 액션은 diff 로거로 흡수·삭제(`moveTask`는 칸반용으로 유지). 대시보드 최근활동에 `field_changed` 라벨 추가.

설계 메모: prop→state 동기화는 repo 규칙(`react-hooks/set-state-in-effect`) 때문에 effect 대신 **'render 중 조건부 setState'(derive during render)** 패턴 사용(칸반 선례와 동일). 프로젝트엔 Comment 모델이 없어 히스토리는 좌측 별도 섹션(태스크는 댓글 옆 우측 레일).

검증: `prisma migrate dev --name task_md`(additive, 로컬 dev DB, 데이터 보존) + `generate` 성공, `tsc --noEmit` clean, `eslint src` 신규 0. worktree라 `next build`/`dev`는 병합 후 main.

---

## 2026-07-08 — Phase 4 라이브 QA + 대개편 스트림들

개편 병합 후 라이브 테스트 피드백을 배치(B1~)로 처리 + 대형 스트림 병합.

- **B1 대시보드**: 상태 카운트→필터 목록 링크, 최근 활동에 티켓 key·엔티티 이동. 이후 활동 포맷을 공용 `src/lib/activity-format.ts`(라벨·값해석·`activityDescription`)로 통일 — 대시보드/히스토리 패널이 "태스크명(DESIGN-3) 상태를 백로그→진행중 로 변경"처럼 실제 변경 표시.
- **라이브 픽스**: 저장 전멸(zod `.nullish()`), 드롭다운 id→라벨(→공용 `OptionSelect` 추출), 좌측 탭 순서, 팀 '다음 번호' 제거·멤버 여백(divide-y gap-0), 대시보드 카드 이중 패딩, `InlineDate` controlled(Base UI 경고), 팀→에픽/태스크 라우팅, 아바타 hover 툴팁(이름-팀명).
- **P4 상세 개편(B3+B7+B8)**(`feat/detail-overhaul`): 상세 인라인 편집(수정 다이얼로그 제거)·상태 우측 카드·담당자+보고자, MD 트래킹(태스크 편집·에픽/프로젝트 롤업, `task_md` additive), 업무 히스토리(Activity diff 로깅 + 필드별 before→after). 이후 태스크 상세 댓글/히스토리 **탭**화 + 에픽 필드 링크·검색 콤보박스(`epic-field.tsx`).
- **B2 목록 테이블뷰**(`feat/b2-tables`)→**공용화**(`feat/tables-refactor`): 스프린트/프로젝트/에픽 목록 테이블뷰(전체 행 클릭 `TableRowLink`, 마감 날짜, 여백 통일), 이어 엔티티 표를 `components/tables/`로 추출해 목록+상세 하위목록 재사용(상세 하위목록도 테이블뷰).
- **B9 위키 대개편**(`feat/wiki-overhaul`): 뷰/편집 모드 분리(기본 뷰, 우상단 '편집', `WikiView`/`WikiDetail`), ⋯메뉴 버전기록(복원)·별표, 즐겨찾기(additive `WikiFavorite` + 우측 패널), 사이드바 재설계(상단 버튼 제거→페이지별 `+` 드롭다운·'콘텐츠' 루트·**우클릭 컨텍스트 메뉴** `ui/context-menu.tsx`), Tiptap 확장 `extensions.ts` 공용화.

각 스트림: worktree `tsc`+`eslint` 검증 → 병합 후 main에서 Turbopack `next build`. additive 마이그레이션(`task_md`·`wiki_favorite`)마다 dev 서버 재시작. worktree+Turbopack/npm/prisma 함정은 [gotchas](./gotchas.md).

---

## 2026-07-08 — Phase 3 진행 + 라이브 버그 픽스

개편 병합 후 라이브 테스트에서 나온 이슈 + phase 3 스트림 병합.

- **긴급: 저장 전멸 수정** — `validators.ts`의 `optionalId`/`optionalDate`가 `.optional()`만이라 폼이 보내는 `null`(미선택 관계/빈 날짜)에서 ZodError → 모든 create/update 실패. `.nullish()`로 정규화. (DB 문제 아님)
- **드롭다운 id→라벨** — Base UI `SelectValue`가 render 함수 없이 원시 value(cuid/enum)를 노출. 6개 파일 12개 select에 `(v)=>라벨` render 추가. 이후 공용 `OptionSelect`로 추출 리팩터링(`feat/select-refactor`).
- **UI 픽스** — 좌측 탭 순서(태스크→보드), 팀 카드 '다음 번호' 노출 제거.
- **P3-S1 타임라인 일(day) 셀**(`feat/timeline-day`) 병합 — 주 눈금 → 고정폭 일 셀, 주말/오늘 음영, day-index px 배치.
- **P3-S2 위키 폴더+티켓링크**(`feat/wiki-chunk`) 병합 — additive `wiki_folder` 마이그레이션(WikiFolder 테이블 + WikiPage.folderId, 리셋 아님). 폴더 타입(페이지 중첩과 별개), 티켓↔위키 상호링크(WikiPageTaskLink), 에디터 `#` 티켓 멘션(Tiptap v3 suggestion). editor.tsx는 S3의 `@` 멘션용으로 국소화. 병합 시 `@tiptap/suggestion` 물리설치 누락(worktree symlink)으로 빌드 깨져 `npm install`+`prisma generate`로 복구.

검증: 각 병합 후 `main`에서 Turbopack `next build` 통과, lint clean. 스키마 변경(WikiFolder)마다 dev 서버 재시작.

---

## 2026-07-08 — 2단계: Sprint/Project/Team 계층 개편 구현 (#2+#3+#4)

[ADR 0002](./adr/0002-sprint-project-team-restructure.md) + [스펙](./specs/02-03-04-hierarchy-restructure.md)에 따라 계층을 `Initiative > Epic > Task` → **`Sprint > Project > Epic > Task`**로 개편. Initiative 제거, Team=key=유저그룹 통합. `feat/hierarchy-restructure` 브랜치 단독 순차 구현(스키마·공유 파일 광범위라 병렬 대신 순차).

- **스키마**(`prisma/schema.prisma`): `Sprint`·`Team` 신설 + `SprintStatus` enum. `Initiative`→`Project`(key 제거, `sprintId` 추가, 관계명 `InitiativeOwner`→`ProjectOwner`, `LabelsOnInitiatives`→`LabelsOnProjects`). `Epic`/`Task`: `key Int` 제거 → `number Int`+`teamId`+`@@unique([teamId, number])`, `Epic.initiativeId`→`projectId`. `User.teamId` 추가.
- **마이그레이션/시드**: 더미 데이터라 보존 마이그레이션 대신 **리셋 재시드**(`migrate reset` + `migrate dev --name sprint_project_team` + 새 `seed.ts`). 시드는 팀 7개(DESIGN/FRONTEND/BACKEND/AOS/IOS/MARKETING/PM) + 스프린트 2 + 프로젝트 2 + 팀 key 붙은 에픽/태스크(DESIGN-1 에픽·DESIGN-2/3 태스크 등) + 위키. 데모 유저 일부에 팀 배정.
- **key 번호(핵심)**: `src/server/keys.ts`의 `nextTeamNumber(tx, teamId)`가 `prisma.$transaction` 안에서 `Team.seq`를 원자적 증가 → epic·task 공유 연속 시퀀스. 표시 헬퍼 `formatIssueKey(teamKey, number)`(`constants.ts`, 구 `ISSUE_PREFIX` 대체). 병렬 생성 시 번호 중복 없음(검증됨).
- **서버**: `queries.ts` 전면 개편(get*Projects/Sprints/Teams/*Options, 타임라인 그룹핑 project 기준), `actions/initiatives.ts`→`projects.ts`, `sprints.ts`·`teams.ts` 신설, `epics.ts`/`tasks.ts`에 팀 번호 부여(태스크는 에픽 팀 상속), `validators.ts` project/sprint/team 스키마.
- **UI**: 라우트 `initiatives/`→`projects/`, `sprints/`·`teams/` 신설(목록+상세/관리). 폼 `project-dialog`·`sprint-dialog`·`team-dialog` + 에픽/태스크 폼에 팀 select(태스크는 에픽 팀 상속·읽기전용). 네비 이니셔티브→프로젝트 + 스프린트·팀. key 표시 전면 `formatIssueKey`화(item-row/kanban/timeline/property-bar/상세). 팀 필터(`filters/team-filter.tsx`, owner-filter children 슬롯) 에픽/태스크/보드에 추가. 팀 유저 배정 UI(`teams/member-team-select.tsx`).

검증: Turbopack `next build` 통과(TypeScript OK, 신규 라우트 5개 포함). lint **신규 이슈 0**, 오히려 baseline 2건→0건(dashboard 미사용변수 제거 + kanban set-state-in-effect를 'derive during render' 패턴으로 정리). 시드/마이그레이션 성공, 팀 번호 부여 동시성 검증(3 병렬 생성 → 4·5·6 연속·무중복).

---

## 2026-07-08 — 추가 변경 8건: 문서화 + git worktree 병렬 구현

`docs/` 문서 인프라(README·design-system·work-log·roadmap·specs·adr) 구축 + `CLAUDE.md` 라우팅 추가(옛 Linear 다크 서술 현행화). git 저장소 초기화(`main`) 후, 결정·스키마가 필요 없는 독립 스트림 4개를 **git worktree + 병렬 서브에이전트**로 구현하고 `main`에 순차 병합.

- **#1 타임라인 겹침**(`feat/timeline-overlap`): `epic-timeline.tsx` 주 헤더 라벨 밀도 기반 thinning(`labelStep`), 라벨 `whitespace-nowrap`, 에픽 바 `overflow-hidden`. 부수적으로 선재 `:77` 경고도 정리.
- **#7 사용자 필터**(`feat/user-filter`): `queries.ts`에 optional `ownerId`/`assigneeId`(하위호환), 공용 `filters/owner-filter.tsx`(paramKey로 owner/assignee 겸용, #4 확장 대비), 이니셔티브/에픽/보드 페이지 적용.
- **#8 위키 버그**(`feat/wiki-bugs`): 자동저장 리비전 폭증 가드(무변경 시 DB 쓰기 skip), 삭제 시 재귀 후손 카운트 경고, 링크 입력 `window.prompt`→Popover, `beforeunload` 가드. 에디터 remount(`key={page.id}`)는 이미 적용돼 있어 확인만.
- **#5+#6 상태바**(`feat/status-bar`): 신규 `detail/property-bar.tsx`(단일 라인 + 인라인 status/assignee/priority select, useTransition+refresh), 엔티티별 경량 액션(`set*Status/Priority/Assignee/Owner`) + `validators.ts` 단일필드 스키마, 3개 detail 페이지 재구성.
- **#2 이니셔티브 상위 항목**: 코드 변경 없이 [`adr/0001-initiative-parent.md`](./adr/0001-initiative-parent.md)로 검토(권장: 현행 유지, 그룹핑은 #3 Project로 흡수) — 사용자 확정 대기.
- **#3·#4 보류**: 커스텀 key(Project 모델)·유저 그룹은 스키마·마이그레이션 동반이라 2단계로.

검증: `main`에서 Turbopack `next build` 통과(Compiled successfully, TypeScript OK, 정적 페이지 생성). 통합 lint 신규 이슈 0 — 선재 baseline이 4건→2건으로 감소(`kanban.tsx:43` error, `dashboard/page.tsx:29` warning만 잔존, 범위 밖). 병합 후 worktree·`feat/*` 브랜치 정리 완료.

주의: 각 스트림은 worktree에서 `tsc --noEmit`+`eslint`로만 검증(Turbopack이 symlink node_modules를 거부). 통합 `next build`는 병합 후 `main`에서 1회.

---

## 2026-07-08 — DESIGN.md 반영(near-white 테마 이관) + 목록 행 리팩터링

### 1. 테마 이관: Intercom cream → Vercel near-white

DESIGN.md가 Vercel 계열 near-white 라이트 전용으로 정의됨에 따라, 기존 cream 테마를 이관.

- **`src/app/globals.css`**: `:root` 색 토큰 전면 리매핑.
  - 캔버스 `#f5f1ec`(cream) → `#fafafa`(canvas-soft), 카드 `#ffffff` 유지, 인셋 `#f5f5f5`, 잉크 `#171717`, 헤어라인 `#ebebeb`.
  - `--muted-foreground` `#4d4d4d`(body), `--destructive` `#ee0000`, 신규 `--link` `#0070f3`.
  - 차트 색(`--chart-1..5`)을 브랜드 그라디언트 팔레트로 교체.
  - `--fin-orange`(구 Fin 액센트) 제거.
  - heading tracking `-0.02em` → `-0.025em`(브랜드 보이스 강화).
  - tiptap 인라인 링크 색을 `var(--primary)` → `var(--link)`.
- **`src/app/layout.tsx`**: 다크→라이트 정합화. `<html>`에서 `.dark` 클래스 제거, Toaster `theme="dark"` → `"light"`. (이전엔 `.dark` 클래스인데 `:root`는 라이트 값이라 어긋난 상태였음 — `.dark` 오버라이드 블록이 없어 실제로는 cream이 렌더됨.)
- **`src/lib/constants.ts`**: 상태·우선순위 색을 흰 배경 대비용으로. 텍스트 `-300/-400` → `-600`대, 중립 상태는 neutral 그레이, dot은 채도 유지(`-500`).
- **`src/components/timeline/epic-timeline.tsx`**: today 마커 `bg-red-400` → `bg-red-500`(흰 배경 가독성).
- **`src/app/login/page.tsx`**: 카드 `border-none shadow-lg`(DESIGN.md의 heavy drop-shadow 금지 위반) → `shadow-sm`(inset hairline ring 유지).

검증: `npm run build` 통과(Compiled successfully, TypeScript OK). 실행 중 dev 서버가 `--background: #fafafa` 서빙 확인.

### 2. 목록 행 중복 제거: `ItemRow` 추출

이니셔티브·에픽 목록의 Card-row가 두 파일에 복붙돼 있던 것을 공용 컴포넌트로 추출.

- **신규 `src/components/item-row.tsx`**: `ItemRow` + `RowMeta`. 고정 뼈대 공유 + `meta` 슬롯.
- **`src/app/(app)/initiatives/page.tsx`** / **`epics/page.tsx`**: 인라인 Card-row → `<ItemRow>`. 미사용 import 정리.
- 통일한 점: 키 컬럼 폭 `w-16/w-20` → `w-20`, 컬럼 순서 캐노니컬화(에픽의 상위 이니셔티브 라벨이 우선순위 배지 앞→뒤로 이동).

검증: build·TypeScript 통과. 신규/수정 파일에 lint 문제 없음(기존 `kanban.tsx` set-state-in-effect, `epic-timeline.tsx:77` 경고는 이번 작업과 무관한 선재 이슈).

### 알려진 관찰 사항(미수정)

- `ItemRow`의 `hover:border-primary/40`은 `Card`가 `border` 대신 `ring`을 쓰고 border-width가 0이라 **hover 효과가 실제로는 안 보이는 no-op**. 원본 유지. 필요 시 `hover:ring-primary/30`로 살릴 수 있음.
