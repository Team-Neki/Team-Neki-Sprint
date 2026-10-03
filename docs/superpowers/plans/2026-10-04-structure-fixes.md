# 코드 구조 개선 묶음 구현 계획 (BACKEND-179~193)

**Goal:** 2026-10-04 코드 구조 검토에서 나온 버그·권한 경계·쓰기 경로·중복 drift 를 한 통합 브랜치(`koosco/structure-fixes`)에서 고친다.

**Architecture:** 스키마 변경 없음. 작은 노드(A·K·P)는 통합 브랜치에서 직접, 나머지는 노드별 git worktree 에서 서브에이전트가 병렬로 구현한 뒤 아래 병합 순서로 `--no-ff` 병합한다. 완료 판정은 [오라클](../../oracle/structure-fixes.md).

**범위 밖(티켓만, 결정 필요):** BACKEND-194 삭제 권한 정책, BACKEND-195 보드 DONE 로드 범위, BACKEND-196 refresh 이중 렌더(브라우저 확인 필요).

## 노드

| 노드 | 티켓 | 내용 | 실행 |
|---|---|---|---|
| A | BACKEND-179 | 위키 `@`·`#`·`/` 팝업 즉시 닫힘 — `block-handle.tsx` 콜백 고정, gotchas §40 정정 | 직접 |
| K | BACKEND-180 | 연결 위키 휴지통 필터 + 이슈키 파서 `parseIssueKey` 로 통일 | 직접 |
| P | BACKEND-181 | `requireUser` 를 React `cache()` 로, 데이터 읽는 페이지 6곳에서 호출 | 직접 |
| S1 | BACKEND-182 | `*Core` 를 `src/server/services/*`(`"use server"` 없음)로 이동 | wt-s |
| S2 | BACKEND-183 | 다이얼로그 `update*` 를 `update*Fields` Core 로 위임 | wt-s |
| S3 | BACKEND-184 | 쓰기+알림 트랜잭션, 위키 충돌 검사 원자화, MCP 위키 POST 1단계 | wt-s |
| S4 | BACKEND-185 | 위키 초안·휴지통 가드(MCP GET/PATCH, 본문 저장) | wt-s |
| B | BACKEND-186 | 보드 재정렬 이웃 중간값(1행 UPDATE), 실패 시 기존 재번호 폴백 | wt-b |
| W1 | BACKEND-187 | `use-wiki-editor.ts` 훅 + 공지 에디터 첨부·붙여넣기·트리플클릭 패리티 + 확장 `useMemo` | wt-w |
| W2 | BACKEND-188 | `editor.tsx` 에서 툴바·버블·표 hover 컨트롤 분리, `applyLink` | wt-w |
| M | BACKEND-189 | 댓글 입력 3곳 `submittingRef` 가드 + `wiki-comments-view` 확장 `useMemo` | wt-m |
| G | BACKEND-190 | 제안 메뉴 3벌 공용화 + 선택 항목 `scrollIntoView` | wt-g |
| L | BACKEND-191 | `parseListFilters`(enum 화이트리스트) + 공용 URL 훅, 초기화·디바운스·`?sprint=` 정리 | wt-l |
| F | BACKEND-192 | `use-field-save.ts` 공용화, `InlineDescription` 분리, 라벨 래퍼 정리 | wt-f |
| Q | BACKEND-193 | 상세 셸(헤더·설명·하위 목록) 공용화 + 부모 링크 통일 | wt-q (F 병합 후) |

## DAG

실선은 진짜 의존(같은 줄을 고치거나 옮김), 점선은 파일만 겹쳐 병합 순서로 푸는 관계다.

```mermaid
flowchart LR
    subgraph direct["통합 브랜치 직접"]
        A["A 팝업 버그"]
        K["K 위키 링크·이슈키"]
        P["P requireUser"]
    end
    subgraph wts["wt-s (한 에이전트, 순차 커밋)"]
        S1["S1 Core 이동"] --> S2["S2 update 위임"] --> S3["S3 트랜잭션"] --> S4["S4 초안 가드"]
    end
    subgraph wtw["wt-w (한 에이전트, 순차 커밋)"]
        W1["W1 에디터 훅"] --> W2["W2 editor.tsx 분리"]
    end
    B["B 보드 정렬"]
    M["M 댓글 가드"]
    G["G 제안 메뉴"]
    L["L 목록 필터"]
    F["F 필드 저장 훅"]
    Q["Q 상세 셸"]
    P --> F
    P --> L
    F --> Q
    P --> Q
    B -.tasks.ts 다른 함수.- S2
    K -.queries.ts 다른 함수.- S4
```

## 파일 영역 배정

A·K·P 를 먼저 통합 브랜치에 커밋하고, worktree 는 그 뒤 HEAD 에서 만든다(P 와 F·L 의 페이지 import 충돌 방지).

| 노드 | 만지는 곳 | 만지지 않을 것 |
|---|---|---|
| A | `wiki/block-handle.tsx` 의 `onNodeChange`, `docs/gotchas.md` §40 | 그 외 |
| K | `queries.ts` `getTask` 의 `wikiLinks`(693행 부근)·`getEntityWikiLinks`(1003~1030)·태스크/전역 검색의 이슈키 매칭(1044, 1135 부근) | `getWikiPage`(S4 소유) |
| P | `lib/session.ts`, `board`·`labels`·`timeline`·`tasks/[id]`·`epics/[id]`·`sprints/[id]` 의 `page.tsx` 상단(import + 첫 줄 호출) | 페이지 본문 |
| S | `server/actions/{tasks,epics,projects,sprints,wiki,comments,wiki-comments}.ts`, 신규 `server/services/*`, `app/api/mcp/v1/**`, `queries.ts` `getWikiPage`, `wiki/[id]/page.tsx` 의 `getWikiPage` 호출, `lib/validators.ts` | `actions/tasks.ts` `reorderBoardTask`(101~175, B 소유), `forms/*`(액션 시그니처 유지) |
| B | `actions/tasks.ts` `reorderBoardTask` 본문, `lib/order.ts`(+test) | 그 외 tasks.ts |
| W | `wiki/editor.tsx`, `announcements/announcement-editor.tsx`, `wiki/wiki-view.tsx`, 신규 `wiki/use-wiki-editor.ts`·`editor-toolbar.tsx`·`bubble-toolbar.tsx`·`table-hover-controls.tsx`, `docs/oracle/wiki-editor-usability.md` 경로 갱신 | `extensions.ts`, 댓글·멘션·슬래시 파일 |
| M | `wiki/wiki-comments-view.tsx`, `wiki/wiki-page-comments.tsx`, `wiki/comment-thread-card.tsx` | 그 외 |
| G | `wiki/ticket-mention.tsx`, `wiki/person-mention.tsx`, `wiki/slash-menu.tsx`, `wiki/slash-command.ts`, 신규 공용 모듈, 필요 시 `extensions.ts` 의 해당 확장 등록 줄 | `editor.tsx` |
| L | 목록 `page.tsx` 5곳(tasks·epics·projects·sprints·board)의 searchParams 파싱부, `components/filters/*`, 태스크 필터 컴포넌트, 신규 `lib/list-filters.ts`(+test) | 페이지 렌더 JSX 구조 |
| F | `detail/inline-fields.tsx`, `detail/inline-assignee.tsx`, `detail/epic-field.tsx`, `detail/{task,epic,project}-labels.tsx`, `detail/entity-labels.tsx`, 신규 `detail/use-field-save.ts`·`detail/inline-description.tsx`, 상세 4페이지의 `InlineDescription` import 줄 | 상세 페이지 본문 |
| Q | 상세 4페이지 본문, 신규 `detail/*` 셸 컴포넌트 | F 가 만든 훅 내부 |

## 병합 순서

작은 diff 부터, 파일 이동·리팩터링은 마지막: **M → B → G → L → F → S → W → (Q 디스패치·병합)**. 병합마다 `tsc`·`eslint`·`vitest`.

## Task A — 팝업 버그 (BACKEND-179)

`block-handle.tsx` 의 `onNodeChange` 를 `useCallback(..., [])` 로 고정(`posRef`·`setMenuOpen` 은 안정적). gotchas §40 의 "재등록하지만 루프는 아님" 을 "재등록이 모든 plugin view 를 destroy 해 Suggestion 팝업이 닫힘" 으로 정정.

## Task K — 연결 위키 휴지통 + 이슈키 (BACKEND-180)

링크 조회 세 곳(`getTask.wikiLinks`, `getEntityWikiLinks` 3분기)에 `where: { page: { deletedAt: null } }`. 초안은 연결 시점 검색이 거르고 정식→초안 전환이 없으므로 필터 불필요(주석 정정). 이슈키 매칭은 `parseIssueKey`(trim·대문자, 영문 시작) 하나로.

## Task P — 페이지 인증 (BACKEND-181)

`requireUser` 를 `cache()` 로 감싸 요청당 1회 조회. 데이터를 읽는데 `requireUser` 가 없던 페이지 6곳 첫 줄에서 호출(`@detail` 4곳은 전체 페이지를 재사용하므로 자동 적용, `wiki/page.tsx` 는 정적이라 제외).

## Task S — 서버 쓰기 경로 (BACKEND-182~185, 한 에이전트·4커밋)

- **S1**: `createTaskCore`·`updateTaskFieldsCore`·`deleteTaskCore`·`createEpicCore`·`updateEpicFieldsCore`·`deleteEpicCore`·`createWikiPageCore`·`updateWikiContentCore`·`addEntityCommentCore` 를 `src/server/services/<entity>.ts` 로 이동(`"use server"` 없음). 액션과 MCP 라우트는 서비스를 import. `server-only` 패키지는 미설치라 쓰지 않는다 — prisma 를 import 하는 모듈은 클라이언트 번들에서 빌드가 깨지므로 그게 가드다(`ponytail:` 주석).
- **S2**: `updateTask/Epic/Project/Sprint(id, input)` 시그니처는 유지하고 본문을 `update*Fields` 경로(Core)로 위임. projects·sprints 는 Core 가 없으면 `update*FieldsCore` 를 서비스로 새로 뺀다. 다이얼로그 입력이 patch 스키마를 통과하는지 확인(`.nullish()` 규칙, gotchas §3).
- **S3**: 위키 저장(리비전·페이지·알림)과 `update*FieldsCore` 의 변경+알림, 댓글 생성+알림을 `prisma.$transaction` 으로(공지 `announcements.ts` 패턴). 위키 충돌 검사는 `updateMany({ where: { id, updatedAt: expected } })` 의 count 로. MCP 위키 POST 는 `createWikiPageCore` 가 초기 본문을 받아 1단계로.
- **S4**: `getWikiPage` 가 초안을 작성자에게만 돌려주게(뷰어 인자) 하고 MCP GET/PATCH 와 `updateWikiContentCore` 에서 초안(타인)·휴지통을 거부. 위키 상세 페이지의 기존 `notFound` 동작 유지.

## Task B — 보드 정렬 (BACKEND-186)

이동 태스크를 "다음 visible 태스크 바로 앞" 에 둔다(현 숨은 태스크 앵커 규칙과 동치). 새 `boardOrder` = 전체 컬럼 순서에서 그 앞 태스크와 다음 visible 태스크의 중간값, 다음이 없으면 최댓값+1. 이웃 값이 null 이거나 간격이 1e-9 미만이면 기존 전체 재번호 경로로 폴백. 중간값 계산은 `lib/order.ts` 순수 함수 + 테스트.

## Task W — 위키 에디터 (BACKEND-187~188, 한 에이전트·2커밋)

- **W1**: `use-wiki-editor.ts` 가 `wikiExtensions()`+`UploadPlaceholder`+`editorProps`(paste·drop·tripleClick)를 `useMemo` 로 고정해 `useEditor` 에 넘긴다. `editor.tsx` 와 `announcement-editor.tsx` 가 사용. 저장 단축키·beforeunload effect 중복도 훅으로. `wiki-view.tsx` 확장 배열 `useMemo`.
- **W2**: `Toolbar`(907~끝)와 그 하위 버튼들 → `editor-toolbar.tsx`, `BubbleToolbar`·`BubbleBtn`·`showBubble` → `bubble-toolbar.tsx`, `TableHoverControls`(473~693) → `table-hover-controls.tsx`. 링크 적용 중복(버블·툴바)을 `applyLink` 하나로. 저장·임시저장 흐름은 `editor.tsx` 에 둔다. `docs/oracle/wiki-editor-usability.md` 의 `editor.tsx` 경로 grep 을 새 파일로 갱신.

## Task M — 댓글 중복 전송 (BACKEND-189)

입력 3곳에 `submittingRef`(동기 가드, `editor.tsx` `savingRef` 패턴) — 버튼·Cmd+Enter 공통 경로 맨 앞에서 검사·설정, `finally` 에서 해제. `wiki-comments-view.tsx` 확장 배열 `useMemo`.

## Task G — 제안 메뉴 (BACKEND-190)

세 메뉴의 키보드 탐색·render 수명주기(`onStart/onUpdate/onKeyDown/onExit`)를 공용 모듈로. 선택 항목 변경 시 `scrollIntoView({ block: "nearest" })`. 칩 노드는 그대로.

## Task L — 목록 필터 (BACKEND-191)

`lib/list-filters.ts` 의 `parseListFilters(searchParams, spec)` 가 배열화·enum 화이트리스트(잘못된 status 무시)·`hasFilter` 를 한 번에. 클라이언트 필터 컴포넌트는 공용 URL 갱신 훅 하나. 태스크 필터 초기화는 `sort`·`dir` 보존, 검색어는 300ms 디바운스, 프로젝트 `?sprint=` 제거.

## Task F — 필드 저장 훅 (BACKEND-192)

`inline-fields.tsx` 의 `useFieldSave`·`useOptimisticValue` 를 `use-field-save.ts` 로 옮기고 `InlineAssignee`·`EpicField` 가 사용(에러 시 refresh 포함). 라벨 래퍼 3벌은 액션 맵으로. `InlineDescription` 을 `inline-description.tsx` 로 분리해 목록 컬럼이 `RichEditor` 를 끌어오지 않게.

## Task Q — 상세 셸 (BACKEND-193)

F 병합 후. 상세 4페이지의 헤더(뒤로·키·제목·삭제)·설명 카드·하위 목록 섹션(헤더·진행률·표)을 슬롯만 받는 얇은 컴포넌트로. 에픽→프로젝트, 프로젝트→스프린트 필드를 태스크→에픽(`EpicField`)처럼 링크+변경 형태로 통일.
