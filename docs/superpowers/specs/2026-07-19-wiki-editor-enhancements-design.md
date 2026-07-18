# 위키 에디터 개선 6종 설계

2026-07-19. 승인된 방향: 초안은 작성자에게만 노출 + 초안 하위 페이지 생성 불가,
줄 핸들은 선택+드래그+블록 메뉴, 테이블은 헤더 행 배경색·셀 배경색·열/행 hover
선택 버튼 전부, 배포는 main 기반 한 브랜치/PR(`feat/wiki-editor-enhancements`).

## 1. 생성 모드 + 초안(draft) 페이지

### 현재

`NewPageButton` 이 즉시 실제 페이지("제목 없음")를 만들고 `/wiki/{id}` 로 이동,
사이드바 트리가 `pendingRenameId` 로 rename 인풋에 포커스한다. 문서는 뷰 모드.

### 변경

- **스키마**: `WikiPage.isDraft Boolean @default(false)` 추가(마이그레이션).
  기존 페이지는 default false — 백필 불필요.
- **생성**: UI 생성 경로(`createWikiPage`)는 `isDraft: true` 로 생성.
  MCP/API(`createWikiPageCore` 직접 호출)는 종전대로 false(본문 포함 생성).
  초안 생성 시 `logActivity("created")` 를 남기지 않는다(취소되면 노이즈) —
  첫 커밋 때 남긴다.
- **진입**: 생성 직후 `/wiki/{id}?edit=1` 로 이동. 상세 페이지가 `edit=1` 이면
  `WikiDetail` 이 편집 모드로 시작하고 **제목 인풋에 autoFocus**. 제목에서
  Enter 시 본문 첫 위치로 포커스 이동. 사이드바 `pendingRenameId` 페이지
  rename 진입은 제거(폴더는 유지).
- **정식 전환**: `updateWikiContentCore` 저장 시 `isDraft: false` 로 전환 +
  이때 `logActivity("created")`. 내용이 unchanged 라도 초안이면 플래그만
  해제(리비전 스냅샷은 만들지 않음).
- **취소**: 기존 동작(임시저장본 폐기 + 뷰 복귀) 그대로 — 페이지는 초안으로
  남고 사이드바에 흐리게 + 제목 우측 `[초안]` 표시.
- **노출 규칙(작성자에게만)**:
  - 트리(`getWikiTree`): `deletedAt: null AND (isDraft = false OR authorId = 나)`.
  - 상세 직접 URL: 타인 초안이면 `notFound()`.
  - 검색(`searchWikiPages`·`globalSearch`)·링크 검색·멘션 자동완성: 초안 전체
    제외(`isDraft: false`) — 본인 초안도 검색 노이즈라 제외, 사이드바로 접근.
  - MCP 검색/조회는 위 쿼리를 공유하므로 자동 적용. 단 MCP `get_wiki_page`
    직접 조회는 상세와 동일 가드.
- **초안 하위 생성 불가**: 트리에서 초안 노드의 '하위 페이지 추가' 버튼 숨김 +
  서버(`createWikiPageCore`)에서 parent 가 초안이면 에러(이중 방어).

## 2. 글자 색상 팔레트 확장

- 정본을 `src/components/wiki/colors.ts` 로 분리: `TEXT_COLORS`(기존 8 → 10:
  기본 잉크 복원 스와치 없이 회색·갈색·빨강·주황·노랑·초록·청록·파랑·보라·분홍),
  `BG_COLORS`(아래 3에서 사용), `CELL_COLORS`(테이블용, 아래 5).
- 툴바 `ColorButton` 팝오버와 버블 툴바 색상 모드가 같은 정본을 사용,
  5열 그리드. '기본 색'(unset) 유지.

## 3. 글자 배경색(하이라이트)

- 이미 설치된 `@tiptap/extension-text-style` 의 `BackgroundColor` 확장 등록
  (신규 의존성 없음). textStyle 마크에 `backgroundColor` 로 저장, 뷰도 동일
  스키마라 자동 렌더.
- `BG_COLORS`: 파스텔 9종(회색·갈색·주황·노랑·초록·청록·파랑·보라·분홍 배경).
- UI: `ColorButton` 팝오버를 '글자 색' / '배경색' 두 섹션으로, 버블 툴바
  색상 모드도 두 줄로. '없음'(unsetBackgroundColor) 포함.

## 4. 노션식 줄 핸들(블록 핸들)

- `@tiptap/extension-drag-handle-react`(v3 MIT) 도입. tiptap 패키지는
  lockstep 이므로 전체 `@tiptap/*` 를 동일 마이너로 정렬(^3.28). 설치 후
  `npm ls @tiptap/core` 로 단일 버전 확인.
- 편집 모드 전용: `WikiEditor` 에 `<DragHandle>` 렌더 — hover 한 블록 좌측에
  ⋮⋮ 버튼. 기능:
  - **드래그**: 블록 이동(확장 내장).
  - **클릭**: 해당 블록 NodeSelection(줄 선택) + 블록 메뉴 팝오버(복제·삭제).
  - 메뉴 액션 후 포커스 복원.
- 뷰 모드(WikiView·댓글 뷰)에는 렌더하지 않는다(에디터 컴포넌트 소유라 자동).

## 5. 테이블 개선 3종

- **셀 배경색 attr**: `TableKit` 의 `tableCell`/`tableHeader` 를 확장해
  `backgroundColor` attr 추가(`data-bg` + inline style 직렬화). 적용은
  `setCellAttribute("backgroundColor", v)` — 현재 셀/셀 선택 영역에 적용.
- **셀 배경색 UI**: 우클릭 컨텍스트 메뉴(`table-context-menu.tsx`)에
  `CELL_COLORS` 스와치 행 + '없음' 추가(셀·행 전체·열 전체 메뉴 공통).
- **헤더 행 배경색**: 표 팝오버 메뉴(`TableButton` in-table)에 '헤더 배경색'
  스와치 — 첫 행(헤더 행) 전체 셀에 backgroundColor 일괄 적용(`table-edit.ts`
  헬퍼). 헤더 기본 회색(`--muted`)은 CSS 그대로, attr 있으면 우선.
- **열/행 hover 선택 버튼**: `TableHoverControls` 확장 — 표 상단(열별)·좌측
  (행별)에 hover 시 나타나는 선택 스트립. 클릭 = 해당 열/행 전체
  `CellSelection`(prosemirror-tables `colSelection`/`rowSelection`). 선택 후엔
  기존 우클릭 메뉴·Ctrl+Backspace 삭제·배경색 적용이 그대로 연계된다.

## 6. 텍스트 정렬(블록 단위)

- `@tiptap/extension-text-align` 을 `heading`+`paragraph` 에 등록(행=블록 단위
  적용). `style="text-align: ..."` 직렬화라 뷰 자동 렌더.
- UI: 툴바에 정렬 팝오버(왼쪽/가운데/오른쪽, 현재 상태 표시), 버블 툴바에도
  3버튼. 기본 단축키(Cmd+Shift+L/E/R) 내장 활용.

## 에러 처리

- 초안 가드: 서버 액션에서 parent 초안·타인 초안 접근 시 명시 에러/notFound.
- 셀 배경색: 표 밖에서 커맨드 no-op(기존 컨텍스트 메뉴가 표 안에서만 열림).
- DragHandle 은 에디터 destroy 시 자동 정리(확장 내장). 메뉴 팝오버는
  블록 선택 해제 시 닫는다.

## 테스트

- vitest(순수): colors.ts 정본 무결성(중복 값 없음), 초안 노출 필터 조건은
  쿼리 레벨이라 유닛 제외(수동 QA).
- 수동 QA: 생성→편집 진입→취소→[초안] 표시→재편집→저장→정식 전환,
  타인 계정 초안 비노출, 색/배경/정렬 저장·뷰 렌더, 핸들 드래그/메뉴,
  테이블 3종, 기존 문서 회귀.

## 범위 밖(후속 제안 — 별도 검토)

콜아웃 블록, 토글 블록(Details), 자동 목차(TableOfContents), 찾기/바꾸기,
마크다운 내보내기, 코드블록 줄번호, 이미지 캡션, 실시간 동시 편집(Yjs),
페이지 템플릿. 상세는 PR 설명·보고에 정리.
