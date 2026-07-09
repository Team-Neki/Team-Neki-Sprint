# 로드맵 v2 / 백로그

2026-07-08 시점, [roadmap.md](./roadmap.md)의 Phase 1~4 백로그가 전부 `DONE`으로 닫힌 뒤 새로 도출한 개선 후보 모음. `tsc`·`eslint` 클린, 코드 내 미해결 TODO/FIXME 없음 상태에서, **문서에 이미 기록돼 있던 "알려진 한계"** + **코드 확인으로 새로 드러난 갭**을 백로그로 적재.

각 항목은 **현상/배경 · 접근안 · 영향 파일 · 데이터 모델 영향 · 열린 질문 · 규모 · 상태**로 스코핑. 구현 착수 전 이 문서에서 접근안과 열린 질문을 먼저 합의한다.

상태 범례: `TODO`(미착수) · `REVIEW`(조사·결정 필요) · `WIP` · `백로그`(의도적 보류) · `DONE`

## 상태 현황(요약)

한눈에 보는 전체 백로그 상태. 상세는 각 항목 섹션 참조. (2026-07-09 기준)

| 항목 | 내용 | 그룹 | 규모 | 상태 |
|---|---|:---:|:---:|---|
| A1 | 알림 실시간 폴링 | A | S | `DONE` |
| A2 | 보드 필터 재정렬 정합성 | A | S~M | `DONE` |
| A3 | 위키 댓글 앵커 동시편집 가드 | A | M | `DONE` |
| A4 | `ItemRow` hover 수정 | A | XS | `DONE` |
| B5 | 자동화 테스트 인프라 | B | M~L | `DONE` |
| B6 | eslint `.worktrees` ignore | B | XS | `DONE` |
| C7 | 전역 검색 / ⌘K | C | M | `DONE` |
| C8 | `Label` 스키마 표면화 | C | M | `DONE` |
| D1 | 테스트 깊이 | D | M | `WIP` (순수 유닛 완료 · 통합/E2E 인프라 잔여) |
| D2 | 삭제 인가 게이트 | D | S | `DONE` |
| D3 | 캐싱 전략(데이터 레이어) | D | L | `DONE` (안전 부분집합) |
| D4 | 실시간(폴링→SSE) | D | M | `백로그` (현 규모 폴링 충분) |
| D5 | 에러 핸들링 일관화 | D | S | `DONE` (검토 — 이미 일관, 변경 불필요) |
| D6 | 문자열 인자 액션 검증 | D | XS | `DONE` |
| D7 | 에픽 라벨 부여 | D | S | `DONE` |
| D8 | `WikiView` content 동기화 | D | XS | `DONE` |
| D9 | 아바타 트리거·정렬·a11y | D | S | `DONE` |
| D10 | 위키 본문 전문검색 | D | M | `DONE` |
| D11 | 태스크 의존성(blocks/blockedBy) | D | M | `DONE` |
| D12 | 라우트 에러/로딩 바운더리 | D | M | `DONE` |
| D13 | 위키 리치 렌더링(표·코드·mermaid) | D | M | `DONE` |
| E1 | 추정 단위 SP→MD 일원화 · storyPoints 컬럼 DROP | E | M | `DONE` |
| E2 | 리뷰 상태(IN_REVIEW) 제거 + 기존 행 BACKLOG 이관 | E | S | `DONE` |
| E3 | 목록 UX — 행클릭 시트·제목 클릭에딧·정렬 3단계·컬럼 순서(우선순위→상태)·MD 직접입력/정렬 | E | M | `DONE` |
| E4 | 상세 시트 — 컨테이너 쿼리(겹침 수정)·Suspense 스트리밍(깜빡임 제거)·scrollbar-gutter | E | M | `DONE` |
| E5 | 타임라인 재디자인 — 담당자 그룹·2줄 날짜축·세로줄 제거·에픽/태스크 회색 구분·sticky 라벨 | E | M | `DONE` |
| E6 | 위키 수정 버튼 이동 · MD 툴팁(FieldHint) · 유저메뉴 nativeButton 수정 | E | S | `DONE` |

**열린 항목은 D1(테스트 통합/E2E 인프라)와 D4(SSE, 의도적 보류)뿐.** 나머지 전부 `DONE`.

> **그룹 E — UX 개선 2차(2026-07-09, 커밋 `0984416`)**: 사용자 피드백 기반 목록/상세/타임라인 UX + 추정 단위 MD 일원화 + 리뷰 상태 제거. DB 스키마 변경 2건(마이그레이션) 포함. 상세는 [work-log](./work-log.md#2026-07-09--추정-단위-md-일원화--목록상세타임라인-ux-개선--리뷰-상태-제거) · 함정은 [gotchas §12·§19·§20](./gotchas.md).

> **진행 현황(2026-07-08): 8건 전부 `DONE`·`main` 병합.** git worktree 병렬 4파 구현(A4·B6·A2·A3 → A1·C7 → C8 + B5). 각 파 병합 후 통합 `tsc`+`eslint`+`next build` 통과, 신규 테스트 73건 green. 상세는 [work-log](./work-log.md).

## 우선순위 개요

- **그룹 A — 알려진 한계 마무리**: 이미 근거가 문서에 박혀 있어 착수 쉬움. A1·A4·B6은 반나절 배치로 묶어 닫기 좋음.
- **그룹 B — 품질/인프라**: 테스트 0건이 최대 구조적 리스크. 장기 가치 최상.
- **그룹 C — 제품 기능 갭**: 전역 검색 부재, Label 데드 스키마.

추천 순서(초안): **(A1+A4+B6 빠른 배치)** → **B5 테스트 인프라** → **C7 전역 검색** → 나머지.

---

## 그룹 A — 알려진 한계 마무리

### A1. 알림 실시간 갱신(폴링/리밸리데이트) · 규모 S · `DONE`

> 구현: 벨(`notification-bell.tsx`)이 props로 로컬 상태 시드 → `getBellNotifications` 서버액션을 45s `setInterval` 폴링 + 팝오버 열 때 즉시 재조회. 외부 라이브러리 없음. 접근안 (a) 채택.

- **현상/배경**: `(app)` 레이아웃의 알림 벨이 **소프트 내비게이션에서 갱신되지 않음**(페이지 로드/`router.refresh` 시에만 갱신). 코드 확인 결과 `setInterval`/`revalidateTag`/`useSWR` 등 폴링·재검증 로직이 **0건**. [roadmap.md B5 알려진 한계], [work-log 2026-07-08 B5].
- **접근안**:
  - (a) 벨 컴포넌트(`notification-bell.tsx`)만 클라이언트에서 30~60s `setInterval`로 unread 카운트/목록 폴링(경량 서버 액션 or route handler).
  - (b) 알림 생성 지점(멘션 등)에서 `revalidatePath('/', 'layout')`로 레이아웃 재검증(단, 수신자 세션에는 즉시 반영 안 됨 — 폴링 대비 한계).
  - (c) 장기: SSE/WebSocket 실시간(과설계 — 현 규모엔 폴링으로 충분).
- **영향 파일**: `notification-bell.tsx`, `server/queries.ts`(`getUnreadNotificationCount`), 필요 시 경량 route handler.
- **데이터 모델 영향**: 없음.
- **열린 질문**: 폴링 주기(30s vs 60s)? 벨만 폴링 vs 목록 페이지까지?
- **비고**: 순수 프론트 + 경량 액션 → quick win.

### A2. 보드 필터 활성 시 재정렬 정합성 · 규모 S~M · `DONE`

> 구현: 접근안 (a) full-column renumber. `reorderBoardTask`가 대상 컬럼 전체를 로드 → 숨은 태스크를 직전 visible에 앵커링해 상대 위치 보존 → 전체 일관 재번호로 충돌 제거. Activity `status_changed` 가드·트랜잭션 보존. (sparse midpoint 대신 full renumber 채택 — 컬럼이 작아 저렴·단순·정확.)

- **현상/배경**: 담당자/팀 필터가 켜진 상태에서 칸반 재정렬 시, **보이는 태스크만 `boardOrder` 재번호**되어 숨은(필터된) 태스크의 order와 간섭 가능. [roadmap.md B7-board 알려진 한계], [work-log 2026-07-08 B7-board].
- **접근안**:
  - (a) `reorderBoardTask`가 재번호할 때 **필터 무관 컬럼 전체**를 대상으로(보이는 것 사이에 숨은 것 순서 보존하도록 병합) 재계산.
  - (b) **sparse ordering**: 정수 재번호 대신 앞뒤 이웃의 `boardOrder` 중간값을 부여(`Float`이미 사용 중) → 전체 재번호 없이 삽입, 숨은 태스크 불변.
  - (c) 필터 활성 시 재정렬 비활성/경고(회피, 비권장).
- **영향 파일**: `server/actions/*`(`reorderBoardTask`), `components/board/kanban.tsx`.
- **데이터 모델 영향**: 없음(`Task.boardOrder Float?` 그대로 활용).
- **열린 질문**: sparse ordering의 정밀도 고갈(반복 삽입 시 float 붕괴) 재번호 트리거 기준은?
- **비고**: (b) sparse가 근본적. 드문 엣지라 우선순위 중간.

### A3. 위키 인라인 댓글 앵커 동시편집 경합 · 규모 M · `DONE`

> 구현: 접근안 (a) `updatedAt` 낙관적 체크(스키마 없이). `saveWikiCommentAnchors(pageId, content, expectedUpdatedAt)` — 서버가 현재 `updatedAt`과 대조, 불일치 시 `{ok:false,conflict:true}` 반환 → 클라 토스트+`router.refresh`(덮어쓰기 거부). 성공 시 새 `updatedAt` 반환→기준선 갱신. page.tsx→wiki-detail→view로 `updatedAt` prop 스레딩. 남은 한계: 본문 편집 자체의 last-write-wins는 그대로(앵커 저장만 가드).

- **현상/배경**: 앵커 저장(`saveWikiCommentAnchors`)이 **content 전체 last-write-wins**라, 동시 편집 중 코멘트 부착 시 편집 내용과 경합 가능(뷰 모드 부착이라 실제론 드묾). [gotchas.md §7b], [roadmap.md B10 알려진 한계].
- **접근안**:
  - (a) 저장 시 **버전(리비전/updatedAt) 체크** → stale이면 재적용/거부.
  - (b) 앵커를 content 전체 덮어쓰기 대신 **마크 diff만** 반영(현실적으로 Tiptap content 부분 패치는 복잡).
  - (c) 낙관적 락(페이지 `version` 컬럼 증가) 후 충돌 시 사용자 안내.
- **영향 파일**: `server/actions/wiki-comments.ts`, `components/wiki/wiki-comments-view.tsx`, 필요 시 스키마(`WikiPage.version`).
- **데이터 모델 영향**: (c) 채택 시 `WikiPage.version Int` additive.
- **열린 질문**: 실제 충돌 빈도가 투자 대비 낮음 — 정말 필요한가? (후순위 근거)
- **비고**: 엣지 케이스. 우선순위 낮음.

### A4. `ItemRow` hover 효과 no-op 수정 · 규모 XS · `DONE`

> 구현: `hover:border-primary/40`(no-op) → `hover:ring-primary/30`. Card가 ring 기반이라 border-width 0 → 이제 hover ring이 실제 렌더.

- **현상/배경**: `ItemRow`의 `hover:border-primary/40`이 **실제로 안 보임** — `Card`가 `border` 대신 `ring`을 쓰고 border-width가 0이라 no-op. [work-log 2026-07-08 "알려진 관찰 사항(미수정)"].
- **접근안**: `hover:border-primary/40` → `hover:ring-primary/30`(또는 `hover:ring-1 hover:ring-primary/30`). DESIGN.md의 inset hairline ring 정합.
- **영향 파일**: `src/components/item-row.tsx` 단일.
- **데이터 모델 영향**: 없음.
- **열린 질문**: hover 강조를 넣을지 자체를 제거할지(디자인 취향).
- **비고**: 코스메틱, 1줄. A1과 함께 배치.

---

## 그룹 B — 품질·인프라

### B5. 자동화 테스트 인프라 구축 · 규모 M~L · `DONE` (장기 가치 최상)

> 구현: 접근안 (a) 유닛 우선. Vitest 도입(`vitest.config.ts`, `npm run test`), 순수 로직 유닛 **73건**(validators `.nullish` 정규화·rich-content parse/plainText/mentions·constants·activity-format) 전부 green. `keys.ts`의 DB 바운드 `nextTeamNumber`는 제외(순수 `formatIssueKey`만 커버). deps는 worktree 함정(§2) 회피 위해 **main에서 직접** 설치. 후속: (b) Playwright 스모크는 미착수.

- **현상/배경**: `src` 전체에 `.test`/`.spec` 파일이 **0건**. 모든 검증이 "브라우저 실검증" 수기 의존 → 회귀 취약. 이 프로젝트의 **가장 큰 구조적 리스크**.
- **접근안**:
  - (a) **유닛 우선**: `src/server/keys.ts`(팀 시퀀스 원자 증가·동시성 — 이미 수기로 3병렬 검증했던 로직), `src/lib/validators.ts`(zod `.nullish()` 회귀 방지), `src/lib/rich-content.ts`(parseDoc/plainText), 서버 액션 diff 로거. Vitest.
  - (b) **핵심 플로우 스모크**(Playwright): 로그인(세션 주입)→태스크 생성/상태 변경, 칸반 DnD, 위키 저장/멘션→알림.
  - (c) CI 훅(선택): PR 시 `tsc`+`eslint`+`vitest`.
- **영향 파일**: 신규 `*.test.ts`, `vitest.config.ts`, 테스트 유틸(Prisma 테스트 DB/모킹), 선택 `.github/workflows`.
- **데이터 모델 영향**: 없음(테스트 DB 격리 전략 필요).
- **열린 질문**: 서버 액션 테스트를 실제 테스트 DB(테스트컨테이너/SQLite)로 할지 Prisma 모킹으로 할지? 스모크는 어느 범위까지?
- **비고**: 먼저 유닛(a)만 세워도 큰 안전망. 스모크(b)는 후속.

### B6. eslint `.worktrees` ignore 적용 · 규모 XS · `DONE`

> 구현: `eslint.config.mjs` `globalIgnores`에 `.worktrees/**` 추가.

- **현상/배경**: `eslint.config.mjs`에 `.worktrees` ignore가 **없음**(코드 확인). `.worktrees/`는 gitignore되지만 eslint는 스캔 → lint 결과가 worktree 사본으로 **부풀려 보임**. [gotchas.md §2 "고려"로만 남아 있던 항목].
- **접근안**: `eslint.config.mjs`의 `ignores`에 `.worktrees/**` 추가.
- **영향 파일**: `eslint.config.mjs` 단일.
- **데이터 모델 영향**: 없음.
- **열린 질문**: 없음.
- **비고**: 1줄. A1·A4와 함께 빠른 배치.

---

## 그룹 C — 제품 기능 갭

### C7. 전역 검색 / 커맨드 팔레트(⌘K) · 규모 M · `DONE`

> 구현: `queries.globalSearch`(태스크·에픽·프로젝트·위키·사용자 그룹별 top5, insensitive contains, `TEAM-n` key 매칭, 위키 `deletedAt:null` 필수) + `globalSearchAction` + `command-palette.tsx`(Base UI Dialog, ⌘K/Ctrl+K 전역 키다운, 디바운스, ↑/↓·Enter 내비). 토픽바 마운트. 외부 의존 없음. (구 한계 "위키 제목만"은 D10 에서 본문 전문검색으로 해소.)

- **현상/배경**: `app-shell`·`ui`에 검색 컴포넌트 **0건**(코드 확인). 태스크 목록 필터만 존재하고, **엔티티 횡단 검색·⌘K 커맨드 팔레트가 없음**. Jira+Wiki 통합 워크스페이스에서 큰 갭(태스크/에픽/프로젝트/위키/사용자를 key·제목으로 빠르게 점프).
- **접근안**:
  - (a) 서버 액션 `globalSearch(q)` — 태스크(number/title), 에픽/프로젝트, 위키 페이지, 사용자를 `contains`로 조회(엔티티별 상위 N).
  - (b) `⌘K` 팝오버(Base UI Dialog/Command 패턴) — 결과를 그룹별로, 엔터로 라우팅. 키보드 내비.
  - (c) 위키 `deletedAt: null` 필터 필수(gotchas §8).
- **영향 파일**: 신규 `components/app-shell/command-palette.tsx`, `server/queries.ts`(`globalSearch`), 레이아웃에 트리거·단축키 바인딩.
- **데이터 모델 영향**: 없음(기존 인덱스로 충분, 대량이면 추후 인덱스 튜닝).
- **열린 질문**: 결과 랭킹/그룹 순서? 위키 본문(리치 JSON) 전문 검색까지 할지 제목만 할지?
- **비고**: UX 임팩트 큼. 위키 본문 검색은 별도 스코프로 분리 권장.

### C8. `Label` 스키마 UI 표면화 or 정리 · 규모 M · `DONE`

> 결정·구현: 접근안 (a) 기능화(비파괴·additive) 채택 — 삭제(b) 대신 표면화. 스키마 변경 없음. `getLabels` + 태스크 쿼리 labels include + `labelId` 필터, `actions/labels`(create/update/delete/add·removeToTask), 라벨 뱃지(색 pill), 태스크 상세 라벨 부여 팝오버(인라인 생성), 태스크 목록 `?label=` 필터, `/labels` 관리 페이지 + 네비. **후속(TODO)**: 에픽·프로젝트 라벨 부여(스키마는 이미 지원, 이번엔 태스크만).

- **현상/배경**: 스키마에 `LabelsOnProjects`/`LabelsOnTasks` 등 조인이 있으나 **라벨 관리/필터/뱃지 UI가 없음**(`labels/` 라우트 없음). 즉 **데드 스키마**에 가깝다.
- **접근안**:
  - (a) **기능화**: 라벨 CRUD + 태스크/프로젝트 부여 UI + 라벨 필터(기존 `owner-filter`/`team-filter` 패턴 재사용) + 뱃지 표시.
  - (b) **정리**: 실제 필요가 없다면 스키마·관계 제거(마이그레이션 동반)로 데드코드 축소.
- **영향 파일**: (a) 신규 라벨 관리 UI·라우트·액션·쿼리·필터, 상세/목록 뱃지. (b) `schema.prisma` + 마이그레이션 + 참조 정리.
- **데이터 모델 영향**: (a) 없음(기존 활용). (b) 관계·모델 제거.
- **열린 질문**: **라벨이 제품에 실제 필요한가?** 필요 없으면 (b) 정리가 맞고, 필요하면 (a). — **먼저 결정 필요(`REVIEW`)**.
- **비고**: 결정 선행. Team으로 이미 분류축이 있어 라벨 유스케이스 재확인 필요.

---

## 빠른 배치 후보(반나절)

**A1(알림 폴링) + A4(ItemRow hover) + B6(eslint ignore)** — 근거 명확, 규모 XS~S, 데이터 모델 영향 0. 한 스트림으로 묶어 먼저 닫기 좋음.

---

## 그룹 D — 전체 코드베이스 감사(2026-07-09 리뷰)

목록 개편 후 프로젝트 전반 점검에서 도출. 치명 버그 없음(모든 액션 `requireUser`, 이슈번호 원자 트랜잭션, `any`/`console`/TODO 0). 개선은 깊이·견고성·확장성 위주. **우선순위 P1→P4 순차 진행.**

> **진행 현황(2026-07-09)**: D2·D6·D7·D8·D9(아바타·정렬) `DONE`. D1 순수 헬퍼 유닛 `DONE`(97 pass — searchExcerpt 8건 포함)·통합/E2E는 인프라 필요로 잔여. D5 검토 결과 **이미 일관**(폼·댓글 등 모두 toast)이라 변경 불필요. **D3 캐싱 `DONE`**(공유 목록/옵션/트리 14개 `unstable_cache` + 태그 무효화, force-dynamic 유지·순수 additive — 안전 부분집합만; 고빈도 엔티티 목록 전면 확대는 방침대로 보류). **D9 a11y 전수 점검 `DONE`**(아이콘 전용 요소 이름 갭 2건 수정). **D10 위키 본문 전문검색 `DONE`**(C7 확장 — searchText denorm 컬럼 + 발췌). **D11 태스크 의존성 `DONE`**(blocks/blockedBy + 순환 방지). **D12 에러/로딩 바운더리 `DONE`**(견고성). D4(SSE)는 **의도적 백로그 보류**(현 규모 폴링 충분). 상세는 [work-log](./work-log.md).
>
> **주의(문서 stale 교훈)**: D7·D8 은 실제로는 이미 구현돼 있었는데 상태가 `TODO` 로 남아 있었다. 작업 착수 전 코드로 현행 확인할 것.

### D1(P1). 테스트 깊이 · 규모 M · `WIP`

- **현상/배경**: 순수 로직 유닛 73개(validators·rich-content·constants·activity-format)뿐. 서버 액션·쿼리·`keys.ts`(원자 번호)·컴포넌트·E2E 스모크 전무. 이 규모 앱의 최대 갭.
- **접근안**: (a) 순수/준순수 헬퍼 유닛 확대 — `diffFields`(activity), `extractMentionUserIds`(mentions), `nextTeamNumber`(fake tx). (b) 서버 액션/쿼리 통합 테스트는 테스트 DB(컨테이너) 필요 — 별도 인프라 스코프. (c) Playwright 스모크는 Google SSO 우회(세션 주입) 필요 — 별도 인프라 스코프.
- **열린 질문**: 통합/E2E는 테스트 DB·인증 우회 인프라 선행 필요.
- **비고**: (a)는 즉시, (b)(c)는 인프라 결정 후.

### D2(P1). 삭제 인가(authorization) 게이트 · 규모 S · `DONE`

- **현상/배경**: 인증만 하면 아무 태스크/에픽/프로젝트/위키를 수정·삭제 가능(오너/role 체크 없음; `notifications`만 user 스코프). 내부 협업툴이라 편집 개방은 유지하되, **파괴적 삭제는 무방비**.
- **결정(채택)**: 삭제 계열만 게이트 — **ADMIN 또는 소유자/작성자**(task=reporter, epic/project=owner, wiki=author)만. 편집은 개방 유지.
- **영향 파일**: `server/actions/{tasks,epics,projects,wiki}.ts` + 인가 헬퍼(`lib/authz.ts`).

### D3(P2). 캐싱 전략(force-dynamic 전면) · 규모 L · `DONE`(부분집합)

- **현상/배경**: 23개 중 22개 `force-dynamic`, `revalidateTag`/`unstable_cache` 0. 매 요청 DB 조회.
- **구현(2026-07-09)**: force-dynamic·라우트 캐시는 **그대로 두고 데이터 레이어만** 캐싱(순수 additive). 공유(비유저 종속) 목록/옵션/트리 쿼리 14개를 `unstable_cache`(엔티티별 태그 + 시간 백스톱)로 래핑(`src/lib/cache.ts`+`queries.ts`), mutating 액션에 `revalidateTag`(`bumpTags`)를 교차 엔티티 의존성까지 반영해 배선. 유저별/검색/상세 쿼리는 제외. Next 16 `revalidateTag(tag,{expire:0})`·`use cache` 미채택 배경은 [gotchas §13].
- **잔여(의도적 보류)**: 고빈도·교차의존 큰 엔티티 목록의 전면 캐싱은 정합성 리스크 대비 가치 낮아 보류(트래픽↑ 시 점진 확대). 무리한 리라이트 지양.

### D4(P2). 실시간성(폴링→SSE) · 규모 M · `백로그`

- 알림 벨 45s 폴링(A1에서 도입). 현 규모 적정 → SSE/WebSocket은 규모 커질 때. 백로그 유지.

### D5(P3). 에러 핸들링 일관화 · 규모 S · `DONE` (검토 — 변경 불필요)

- **현상/배경**: `catch {}`/토스트 후 무시가 ~40곳. 의도적(draft 자동저장)도 있으나 일부는 실패가 조용히 묻힘.
- **접근안**: 사용자 대면 실패=토스트, 의도적 무시엔 이유 주석, 서버측은 최소 로깅. 우선 사용자 영향 큰 곳부터.

### D6(P3). 문자열 인자 액션 검증 · 규모 XS · `DONE`

- **현상/배경**: 대부분 액션은 zod 검증하나 `addComment(taskId, body)` 등 문자열 인자는 빈값 체크만.
- **접근안**: 본문 스키마(비어있지 않음·최대 길이·doc JSON 형태) 검증 추가.

### D7(P4). 에픽 라벨 부여 · 규모 S · `DONE`

> 확인(2026-07-09): 이미 구현·배선 완료였음(문서가 stale). `addLabelToEpic`/`removeLabelFromEpic`(actions/labels.ts) + `EpicLabels`(detail/epic-labels.tsx → 공용 `EntityLabels`) + `getEpic` 의 `labels: labelInclude` include + 에픽 상세(`epics/[id]/page.tsx`)에 배선됨. 프로젝트 라벨과 동일 패턴.

### D8(P4). `WikiView`(버전 미리보기) content prop 동기화 · 규모 XS · `DONE`

> 확인(2026-07-09): 이미 구현 완료였음(문서가 stale). `WikiView`(wiki-view.tsx)에 gotchas §10 의 content 동기화 `useEffect`(`setContent(content,{emitUpdate:false})`)가 적용돼 있어 버전 미리보기 전환 시 본문이 갱신됨.

### D10(신규). 위키 본문 전문검색(C7 확장) · 규모 M · `DONE`

> 구현(2026-07-09): C7 전역 검색이 위키를 **제목만** 매칭하던 한계 해소. `WikiPage.searchText`(순수 텍스트 사본) 컬럼 additive 추가 + 저장 경로 3곳(`createWikiPage`/`updateWikiContent`/`restoreWikiRevision`)에서 `docToPlainText(content)` 로 채움 + 기존 7페이지 백필(`prisma/backfill-wiki-search.ts`, idempotent) + `globalSearch` 가 `OR:[title, searchText]` 로 조회, 제목 미매칭·본문 매칭 시 `subtitle` 에 `searchExcerpt` 발췌 표시. 순수 헬퍼 `searchExcerpt` 유닛 8건 추가(총 97 green). 인덱스는 소규모라 미도입(순차 스캔). 배경·동기화 함정은 [gotchas §16]. **후속(TODO)**: 문서·티켓 링크 피커(`searchWikiPages`)는 여전히 제목만(picker 특성상 유지).

### D11(신규). 태스크 의존성(blocks / blockedBy) · 규모 M · `DONE`

> 구현(2026-07-09): PM 툴 핵심 기능 부재(스키마·UI 전무)였음. `TaskDependency`(blocker→blocked 방향 엣지, `@@id`+cascade+`@@index([blockedId])`) additive 추가(마이그레이션 `20260709080738_task_dependency`). 서버 액션 `addTaskDependency`/`removeTaskDependency`(존재 확인·자기참조/**순환 방지**·멱등). 순환 판정은 순수 헬퍼 `lib/task-deps.wouldCreateCycle`(dependsOn 도달성 DFS)로 분리 → 유닛 8건. `getTask` 에 `blockedBy`/`blocking` include. UI `detail/task-dependencies.tsx`(`LinkSearchPopover`+`searchTasksAction` 재사용, 두 방향 리스트, 미완료 blocker '차단됨' 배지) → 상세 사이드바 카드. 방향/순환 함정은 [gotchas §17].
>
> **후속 완료(2026-07-09)**: (1) **보드/목록 '차단됨' 배지** — `getBoardTasks`/`getTasks` 가 `blockedBy` 상태만 로드해 `blocked`(미완료 blocker 존재) 계산, `BlockedBadge`(badges.tsx)를 칸반 카드·태스크 표에 노출. (2) **의존성 Activity 기록** — `add/removeTaskDependency` 가 양쪽 태스크에 `dependency_added`/`dependency_removed` 로그(meta 에 상대 key·title), `activity-format`·`history-panel` 에 렌더 케이스 추가(유닛 2건). 잔여 후속 없음.

### D12(신규). 라우트 에러/로딩 바운더리 · 규모 M · `DONE`

> 구현(2026-07-09): 앱 전체에 `error.tsx`·`loading.tsx` 0개였음(견고성 갭 — throw 시 Next 기본 화면, 느린 force-dynamic 로드 시 빈 화면). `(app)/error.tsx`(client, `reset()` 재시도 + `digest` 표기) + `(app)/loading.tsx`(Skeleton, `aria-busy`) + 루트 `global-error.tsx`(자체 `<html>/<body>`+인라인 스타일 안전망). (app) 하위 전 세그먼트가 상속. 콘솔/외부로그는 관례상 미도입(리포팅 훅 위치만 주석). 배치·검증 주의는 [gotchas §17].

### D13(신규). 위키 리치 렌더링(표·코드 구문강조·mermaid) · 규모 M · `DONE`

> 구현(2026-07-09): 위키 상세에서 표·코드블록(구문강조)·mermaid 다이어그램 렌더링. 확장을 `wikiExtensions()` 한 곳에 등록해 에디터·읽기전용 뷰 자동 공유. 표=`TableKit`(툴바 삽입/행·열 편집 Popover), 코드=`CodeBlockLowlight`+lowlight(StarterKit CodeBlock 대체, hljs 라이트 팔레트 CSS), mermaid=커스텀 atom 노드 `MermaidBlock`(ReactNodeView, `mermaid` 동적 import·지연청크, 편집 textarea+실시간 미리보기, `securityLevel:strict`). 신규 deps 4개(main 직접 설치). 표 셀·코드 텍스트는 검색(§16) 커버, mermaid 소스는 atom 이라 미커버(의도). 함정·검증주의 [gotchas §18]. **검증**: tsc·eslint·vitest 107·build green, **실렌더는 로그인 게이트라 브라우저 확인 필요**.

### D9(P4). 담당자 아바타-only 트리거 · 컬럼 정렬 · a11y 스팟 점검 · 규모 S · `DONE`

- 목록 담당자 인라인 편집 트리거를 아바타-only로. 생성/수정시간·우선순위 컬럼 정렬 토글.(선행 완료)
- **a11y 전수 점검(2026-07-09)**: 아이콘 전용 인터랙티브 요소의 접근 가능한 이름 갭 2건 수정 — 앱 셸 모바일 메뉴 버튼(`layout.tsx`), 위키 에디터 툴바 13개(`editor.tsx`)에 `aria-label`(+툴바는 `title`/`aria-pressed`). `Button` 프리미티브 focus-visible ring 내장·calendar nav 는 라이브러리 라벨 제공이라 무관. 나머지 아이콘 버튼(⋯·닫기·색상칩·연결해제 등)은 이미 커버됨. 상세 [gotchas §14].
