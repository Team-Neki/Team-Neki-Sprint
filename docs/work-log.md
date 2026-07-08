# 작업 로그

세션 단위로 무엇을·왜 바꿨는지 기록한다. 최신 항목이 위.

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
