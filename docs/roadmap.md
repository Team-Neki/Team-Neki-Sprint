# 로드맵 / 백로그

2026-07-08 요청된 추가 변경 사항. 각 항목은 **현상/배경 · 접근안 · 영향 파일 · 데이터 모델 영향 · 열린 질문 · 규모 · 상태**로 스코핑. 구현 착수 전 이 문서에서 접근안과 열린 질문을 먼저 합의한다.

상태 범례: `TODO`(미착수) · `REVIEW`(조사·결정 필요) · `WIP` · `DONE`

## 진행 현황 (2026-07-08)

- **1단계 완료·병합(`DONE`)**: #1 타임라인, #5+#6 상태바, #7 필터, #8 위키 → 스펙([`specs/`](./specs/)) 작성 후 4개 `feat/*` 브랜치에서 **git worktree 병렬 구현** → `main` 병합. Turbopack `next build` 통과, lint 신규 이슈 0(오히려 선재 baseline 4→2 감소).
- **2단계 완료(`DONE`)**: #2 + #3 + #4가 **핑퐁 결정으로 단일 개편에 병합** → [ADR 0002](./adr/0002-sprint-project-team-restructure.md) + [스펙](./specs/02-03-04-hierarchy-restructure.md). 계층을 `Sprint > Project > Epic > Task`로 개편(Initiative 제거), Team=key=유저그룹 통합. `feat/hierarchy-restructure`에서 스키마·마이그레이션·시드·서버·UI 전면 구현 → 리셋 재시드, Turbopack `next build` 통과, lint 신규 0. 상세는 [work-log](./work-log.md).
- **선재 baseline(정리됨)**: 개편 과정에서 `kanban.tsx` set-state-in-effect(error)와 `dashboard/page.tsx` 미사용 변수(warning) 모두 해소 — 현재 lint 완전 clean.

### Phase 4 — 라이브 QA 백로그 (2026-07-08 테스트 중 발견, `TODO`)

배치로 묶어 순차 처리. select-refactor 병합 후 착수(공유 파일 정리 뒤).

- **B1 대시보드**: (10) 최근 활동에 티켓 key 표기 + 이동, (11) 상태 카운트(백로그/할일/진행중/리뷰/완료) 클릭 → 필터된 태스크 목록. → `dashboard/page.tsx`
- **B2 목록/여백**: (1) 태스크 클릭 영역이 컴포넌트보다 좁음, (5) 에픽 목록 열 정렬 어긋남, (6) 태스크 마감에 날짜 표시, (9) 목록 vs 상세 좌우 여백 불일치, **(T) 스프린트·프로젝트·에픽 목록을 태스크처럼 테이블뷰(컬럼)로 — 열 정렬/간격 정리**. → `sprints/page`, `projects/page`, `epics/page`(← B7 MD 컬럼과 겹치니 detail-overhaul 병합 후), `tasks/page`, `item-row`, `(app)/layout`. **팀→에픽/태스크 라우팅(완료)**.
- **B3 상세 페이지 개편** (`DONE` 2026-07-08, `feat/detail-overhaul`): (2) '수정' 버튼 제거 → 전 필드 인라인 편집, (3) 상태를 우측 카드(보고자/스토리포인트/에픽)로 이동, (4) 보고자 옆 담당자 추가, (back) 뒤로가기 스택 동작. → `{tasks,epics,projects}/[id]`, `detail/inline-fields`·`back-button`(property-bar 삭제), `update*Fields` actions
- **B4 타임라인** (`DONE` 2026-07-08): (7) 가로 스크롤 시 좌측 이름 컬럼(프로젝트 타이틀·에픽·태스크) 고정(sticky). → `epic-timeline.tsx` 단일. `sticky left-0` + 불투명 `bg-card` + `z-20`(바/그리드/today 마커 위 덮음) + `self-stretch`(행 높이 전체 커버). 헤더는 full-width화 후 거터 마스크(`z-30`)로 라벨 bleed 방지.
- **B5 프로필/소셜 (= 원래 phase 3 S3)**: (5/8/12) 사용자 프로필 페이지 + 사용자 클릭 시 이동(프로필 라우트 부재로 현재 접속 시 오류), (6) `@` 멘션, (7) 멘션 알림, (8) 알림 목록. → 신규 `users/[id]`, `Notification` 스키마(additive), 에디터 `@`.
- **B6 리치 입력 확장**: 설명(description)·댓글에서도 링크(`#`티켓)/멘션(`@`사람) 동작. 현재 plain textarea → Tiptap 에디터로 교체(위키 에디터 확장 재사용). B5의 멘션/링크 인프라 위에 얹음.
- **B7-board 보드 순서 변경**: 칸반에서 드래그앤드롭으로 **순서 재정렬**(현재는 상태 변경만). 생성 시 컬럼 하단 append, 자유 재정렬. → Task에 순서 필드(additive, 예: `boardOrder Float?`) + `board/kanban.tsx`(@dnd-kit sortable) + 재정렬 서버액션. 스키마 스트림.

- **B7 MD(맨데이) 트래킹** (`DONE` 2026-07-08): `estimatedMd`/`actualMd` 추가(Task에 additive 마이그레이션 `task_md`, 편집은 **태스크만**). Epic md = 하위 태스크 md 합, Project md = 하위 에픽 md 합(`queries.ts` groupBy/집계, 읽기전용 롤업). 상세·목록 `MdRollupText` 표시.
- **B8 업무 히스토리** (`DONE` 2026-07-08): 태스크=댓글 옆 우측 레일, 에픽/프로젝트=좌측 별도 섹션(Comment 모델 없음). "누가 기한/상태/내용을 변경" 기록. **기존 `Activity` 모델 활용** + generic diff 로거(`update*Fields`)가 필드별 `field_changed`+`meta:{field,from,to}` 기록. `getEntityActivity` 조회 + `history-panel` 한국어 문장 렌더.
- **B9 위키 대개편 (뷰/편집·버전·사이드바·즐겨찾기)** — `DONE`(2026-07-08, `feat/wiki-overhaul`):
  - **뷰/편집 모드**: 상세는 기본 **뷰 모드**(읽기전용 렌더) 진입, **우측 상단 '편집' 버튼**으로 편집 모드. 동시편집 허용·저장 시 버전 기록(last-write-wins, 편집 중인 사람 무영향). **기존 `WikiRevision` 활용**.
  - **⋯(점3개) 메뉴**: 버전 기록(목록·이전 버전 확인/복원) + **별표(즐겨찾기) 토글**.
  - **즐겨찾기(신규, additive 스키마)**: 유저별 별표 → `WikiFavorite { userId, pageId }` 조인. 위키 **우측에 즐겨찾기한 페이지 목록** 노출.
  - **사이드바 재설계**: 상단 '폴더/새페이지' 버튼(+우상단 폴더 버튼) **제거** → **각 페이지 우측 hover `+` 버튼 → 드롭다운(폴더 추가 / 새 페이지 추가)**. 루트는 '콘텐츠' 섹션(탭)에 동일 `+`. **사이드바 우클릭 컨텍스트 메뉴**로도 추가/이름변경/삭제 등.
  - → `wiki/page-tree`·`new-folder-button`·`new-page-button` 재작성, `editor.tsx` 뷰/편집 토글, wiki `[id]` 페이지, `queries.ts`(즐겨찾기·버전), `actions/wiki.ts`(별표 토글·복원). tables-refactor와 `queries.ts` 겹쳐 **그 병합 후** 착수.
- **B10 위키 인라인 댓글(구글독스식)**: 본문에서 **텍스트 선택 → 코멘트 달기**, **답글(스레드)** 가능. Tiptap 코멘트 마크(하이라이트+앵커) + 위키 댓글 스키마(신규 — 현재 `Comment`는 태스크 전용이라 `WikiComment`/스레드 additive) + 코멘트 사이드바/팝오버. 규모 L, B9 이후.
- **B5 사용자 페이지(검토 결과: 미구현)**: `/users/[id]` 프로필 라우트가 **아직 없음** → 클릭 시 오류/미이동. 구축 필요(프로필: id·이름·팀·이메일·연락처). B5 스트림에서 생성.

**B1 완료(2026-07-08)**: 대시보드 상태→필터목록 링크 + 최근활동 티켓 key·이동.

### Phase 3 — 신규 8개 기능 (2026-07-08 요청, `WIP`)

핑퐁으로 잠금: 폴더=별도 타입 / 멘션(@)=사람(클릭→프로필) / 링크(#)=티켓. 스트림 그룹핑([specs](./specs/)):
- **S1 타임라인 일(day) 셀**(#1) — 스키마 없음, 독립 worktree 병렬. [p3-01](./specs/p3-01-timeline-day-cells.md)
- **S2 위키 폴더+티켓링크**(#2·#3·#4) — additive Folder 스키마, editor.tsx. [p3-02](./specs/p3-02-wiki-folders-links.md)
- **S3 프로필·멘션·알림**(#5·#6·#7·#8) — additive Notification/User.phone, editor.tsx. **S2 병합 후**(editor 공유). [p3-03](./specs/p3-03-social-mentions-notifications.md)
- 순서: **S1 ∥ S2 → S3**. 스키마는 리셋 아닌 **additive**(기존 데이터 보존). 각 병합 후 dev 서버 재시작(새 client).

---

## 1. 타임라인 날짜 겹침 UI 버그 수정 · `DONE` · 규모 S

- **현상**: `src/components/timeline/epic-timeline.tsx`의 주(week) 헤더 눈금. 각 라벨이 `absolute` + `-translate-x-1/2`로 `left: pct(w)%`에 중앙 정렬되는데(124–135행), 창 폭 대비 주 밀도가 높으면 인접 라벨("7/6"·"7/13"…)이 **충돌 회피 없이 겹친다**. 최소 간격 가드가 없음.
- **접근안**:
  - (a) 라벨 밀도 기반 thinning — 라벨 간 픽셀 간격이 임계 미만이면 N주마다 하나만 표기.
  - (b) 절대 위치 대신 CSS grid 컬럼(주 단위)으로 눈금을 깔고 라벨은 셀 안에 배치.
  - (c) 컨테이너 폭을 측정해 `totalDays` 대비 최소 라벨 폭 보장(가로 스크롤 유지).
- **영향 파일**: `epic-timeline.tsx` 단일.
- **데이터 모델 영향**: 없음.
- **열린 질문**: 겹침이 주 헤더에서만인지, epic/task 바 라벨에서도인지 확인 필요.
- **비고**: 순수 프론트, 사이드이펙트 없음 → 착수 쉬움(quick win).

## 2. 이니셔티브 상위 항목 필요 여부 검토 · `DONE`(구현) → [ADR 0002](./adr/0002-sprint-project-team-restructure.md)

> 핑퐁 결정으로 #3·#4와 함께 Sprint/Project/Team 개편에 병합(Initiative 제거, Project가 상위). 아래 원문은 검토 맥락으로 보존.

- **배경**: 현재 계층은 `Initiative > Epic > Task`(schema 기준 Initiative가 최상위, `parentId` 없음). "이니셔티브 위에 상위 항목이 필요한가"에 대한 제품 결정.
- **옵션**:
  - (a) 현행 유지(플랫 최상위) — YAGNI. 별도 상위 개념 없이 이니셔티브가 최상위 목표.
  - (b) 이니셔티브 self-parent(`parentId` 자기참조) — 하위 이니셔티브 계층 허용.
  - (c) 상위 티어 신설(예: Objective/Theme) — Initiative 위에 새 모델.
- **데이터 모델 영향**: (b)는 `Initiative.parentId` 자기참조 1줄. (c)는 신규 모델 + 관계 + UI 전반.
- **권장(초안)**: 실제 필요가 확인되기 전엔 **(a) 유지**. 그룹핑 필요는 3번(프로젝트 key)이나 라벨로 흡수 가능한지 먼저 검토.
- **열린 질문**: 상위 항목이 필요한 실제 유스케이스(로드맵 묶음? OKR?)가 무엇인가.

## 3. 커스텀 key 지정 기능(DESIGN, SEARCHPL, BACKEND, AOS, IOS…) · `DONE`(구현) → [ADR 0002](./adr/0002-sprint-project-team-restructure.md)

> key = Team으로 확정, #4와 통합. 상세는 [개편 스펙](./specs/02-03-04-hierarchy-restructure.md). 아래 원문은 초기 스코핑으로 보존.

- **배경**: 현재 key는 전역 auto-increment 정수(`INI-1`/`EPIC-1`/`TASK-1`, schema `key Int @unique @default(autoincrement())`). Jira처럼 **프로젝트 접두어 key**(`DESIGN-1`, `SEARCHPL-42`)를 지정하고 싶음.
- **접근안**: **Project(또는 Board)** 개념 도입.
  - 신규 `Project { id, key(예 "DESIGN", @unique), name, seq }`.
  - Initiative/Epic/Task에 `projectId` + 프로젝트별 순번(`number Int`). 표시 key = `${project.key}-${number}`.
  - key 생성은 프로젝트별 시퀀스(원자적 증가 — 트랜잭션/카운터 필요, 동시성 주의).
  - 기존 전역 `key Int`는 마이그레이션 필요(백필: 기본 프로젝트로 이관).
- **영향 범위**: schema + 마이그레이션 + `server/queries.ts`·`server/actions/*` key 생성/표시 + 목록/상세/타임라인의 key 렌더(`INI-`/`EPIC-`/`TASK-` 하드코딩 → 프로젝트 key), `ISSUE_PREFIX`(`constants.ts`) 대체, 프로젝트 선택 UI.
- **열린 질문**: key는 이니셔티브/에픽/태스크가 **공유 시퀀스**(프로젝트 단위 하나의 번호대)인가, 타입별 분리인가? 프로젝트와 이니셔티브의 관계(1:1? 1:N?)는?
- **비고**: 2번(상위 항목)과 연관 — "프로젝트"가 사실상 상위 그룹 역할을 할 수 있음.

## 4. 유저 그룹 기능(backend, frontend, designer…) · `DONE`(구현) → [ADR 0002](./adr/0002-sprint-project-team-restructure.md)

> 유저 그룹 = Team으로 확정(#3 key와 동일 개념, 한 사람=한 팀). 상세는 [개편 스펙](./specs/02-03-04-hierarchy-restructure.md). 아래 원문은 초기 스코핑으로 보존.

- **배경**: 사용자를 직능 그룹으로 묶기. 현재 `User`에 그룹 개념 없음(`role`은 ADMIN/MEMBER뿐).
- **접근안**:
  - 신규 `Group { id, name(@unique), color? }` + `UserGroup` 조인(User↔Group 다대다) 또는 `User.groupId`(단일 소속).
  - 용도: 담당자/오너 그룹 필터(7번과 연동), 그룹 뱃지 표시, 그룹 단위 배정.
- **영향 범위**: schema + 마이그레이션 + 멤버 조회(`getMembers`) 확장 + 그룹 관리 UI(생성/할당) + 필터 UI.
- **열린 질문**: 한 유저가 **복수 그룹** 가능인가(다대다 권장) 단일 소속인가? 그룹 관리 권한은 ADMIN 한정인가?

## 5. 상단 상태바 인라인 편집(수정창 대신 클릭 편집) · `DONE` · 규모 M

- **현상**: 상세 페이지(`src/app/(app)/{initiatives,epics,tasks}/[id]/page.tsx`)에서 상태/담당자/우선순위는 **읽기 전용 배지**로 표시되고, 변경하려면 상단 "수정" 버튼으로 다이얼로그(`TaskDialog` 등)를 열어야 함(tasks 상세는 우측 컬럼 `Field` 스택).
- **목표**: 상태바의 배지를 **직접 클릭해 드롭다운/팝오버로 즉시 변경**(다이얼로그 없이).
- **접근안**:
  - 신규 클라이언트 컴포넌트 `StatusSelect`/`PrioritySelect`/`AssigneeSelect`(Base UI `Select`/`Popover` + `useTransition`).
  - 상태만 바꾸는 경량 서버 액션 추가(예: `updateTaskStatus(id, status)`) 또는 기존 `updateTask` 부분 업데이트 재사용.
  - 3개 엔티티(이니셔티브/에픽/태스크) 공통 사용 → 6번의 단일 상태바 컴포넌트에 내장.
- **영향 범위**: 3개 `[id]/page.tsx` + 신규 select 컴포넌트 + `server/actions/*`에 status/assignee 경량 액션.
- **열린 질문**: 낙관적 업데이트(optimistic) 적용할지, 서버 확정 후 refresh할지.
- **비고**: 6번과 한 세트로 진행 권장.

## 6. 상태바 한 줄 레이아웃 · `DONE` · 규모 S

- **현상**: tasks 상세는 속성이 우측 컬럼에 **세로 스택**(`Field` 반복). 상단에 한 줄 속성바가 없음.
- **목표**: 제목 아래 **단일 가로 라인**의 속성바(상태 · 담당자 · 우선순위 · 마감…)로 정리. Linear 스타일 property bar.
- **접근안**: 공용 `<PropertyBar>` 컴포넌트(가로 flex, 좁은 화면에선 wrap 또는 스크롤). 5번의 인라인 select를 이 바 안에 배치. 3개 상세 페이지에서 공유.
- **영향 범위**: 신규 `property-bar` 컴포넌트 + 3개 `[id]/page.tsx` 레이아웃 재구성.
- **열린 질문**: 모바일에서 한 줄 유지(가로 스크롤) vs wrap 중 무엇.
- **비고**: 5번과 함께 구현.

## 7. 사용자 단위 필터링 · `DONE` · 규모 M

- **현상**: 필터는 태스크 목록에만 존재(`src/components/tasks/task-filters.tsx` — 상태/담당자/검색). 이니셔티브·에픽·보드에는 사용자 필터 없음.
- **목표**: 담당자/오너 기준 사용자 필터를 목록 전반으로 확장(그리고 4번 그룹 필터와 연동).
- **접근안**:
  - `getInitiatives`/`getEpics`에 `ownerId` 필터 파라미터 추가(`getTasks`는 이미 `assigneeId` 지원).
  - 목록 페이지에 필터 UI 추가(공용 필터 컴포넌트로 일반화 검토).
  - 보드(`board`)에도 담당자 필터.
  - 4번 완료 시 "그룹으로 필터" 옵션 결합.
- **영향 범위**: `server/queries.ts` + 이니셔티브/에픽/보드 페이지 + 필터 컴포넌트.
- **열린 질문**: 필터 상태를 URL searchParams(현행 task 방식)로 통일할지.

## 8. 위키 페이지 기능 버그 검토 · `DONE` · 규모 M

`src/server/actions/wiki.ts`, `src/components/wiki/editor.tsx` 리뷰에서 확인된 실제/의심 결함:

- **(확인) 자동저장마다 리비전 폭증**: `updateWikiContent`가 저장 때마다 `WikiRevision`을 생성(56–64행). 에디터는 1.5s 디바운스 자동저장 → **편집 중 1.5초마다 리비전 1건** 누적. → 리비전 스냅샷 조건 필요(디바운스 확대 / 내용 해시 비교 / N분 간격 / 수동 저장 시에만).
- **(의심·확인 필요) 페이지 전환 시 에디터 remount**: `WikiEditor`가 `initialTitle`/`initialContent`를 `useState` 초기값으로만 사용. 위키 `[id]` 라우팅에서 컴포넌트가 `key={pageId}`로 remount되지 않으면 **이전 페이지 내용이 남아 새 페이지에 저장**될 수 있음 → `wiki/[id]/page.tsx` 확인 필요.
- **(확인) 삭제 cascade 자식 소실**: `WikiPage.parent` 관계 `onDelete: Cascade`. 부모 삭제 시 **자식 페이지·리비전 전부 삭제**되는데 `ConfirmDelete`가 이를 경고하지 않을 가능성 → 확인/경고 문구 필요.
- **(UX) 링크 입력 `window.prompt`**: `editor.tsx` `setLink`가 브라우저 `prompt()` 사용(134행). 블로킹 모달·스타일 불가 → 팝오버 입력으로 대체 권장.
- **(경미) unsaved 이탈 가드 없음**: 디바운스(1.5s) 전 이탈 시 편집 유실. `beforeunload`/라우팅 가드 검토.
- **추가 리뷰 대상**: `src/components/wiki/page-tree.tsx`(트리 정렬·`position`·드래그 재정렬 정합성), `new-page-button.tsx`.

---

## 제안 구현 순서(초안)

1. **#1 타임라인 겹침**(quick win, 사이드이펙트 없음)
2. **#8 위키 버그** 중 확정 결함(리비전 폭증·삭제 경고·에디터 remount 확인)
3. **#5 + #6 상태바 인라인 편집 + 한 줄**(한 세트)
4. **#7 사용자 필터**(스키마 변경 없음)
5. **#2 결정** → **#4 유저 그룹** → **#3 커스텀 key**(스키마·마이그레이션 동반, 큰 작업, 순서 의존)
