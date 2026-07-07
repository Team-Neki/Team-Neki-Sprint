# Spec #5+#6 — 상단 상태바 인라인 편집 + 한 줄 레이아웃

- **브랜치**: `feat/status-bar`
- **규모**: M · **스키마 변경**: 없음

## 배경

상세 페이지(`src/app/(app)/{initiatives,epics,tasks}/[id]/page.tsx`)에서 상태/담당자/우선순위는 읽기 전용 배지로 표시되고, 변경하려면 "수정" 버튼으로 다이얼로그를 열어야 한다. tasks 상세는 속성이 우측 컬럼에 세로 스택(`Field` 반복)돼 있다.

## 목표 (두 항목 한 세트)

- **#6**: 제목 아래 **단일 가로 라인** property bar(상태 · 담당자 · 우선순위 · 마감 등). Linear 스타일.
- **#5**: 그 바의 상태/담당자/우선순위를 **직접 클릭해 드롭다운/팝오버로 즉시 변경**(다이얼로그 없이).

## 결정된 접근

- 공용 컴포넌트 `src/components/detail/property-bar.tsx`:
  - 가로 flex 한 줄, 좁은 화면은 `flex-wrap`(가로 스크롤 아님).
  - 슬롯: 상태(select) · 담당자(select) · 우선순위(select) · 마감일(표시, 편집은 이번 범위 밖) 등.
- 인라인 편집 컴포넌트(클라이언트): Base UI `Select`/`Popover` 사용.
  - `StatusSelect`, `PrioritySelect`, `AssigneeSelect` (또는 property-bar 내부 서브컴포넌트).
  - 변경 시 **경량 서버 액션** 호출. 낙관적 업데이트 대신 `useTransition` + `router.refresh()`로 서버 확정 후 반영.
- 서버 액션: 엔티티별 상태/담당자/우선순위 부분 업데이트.
  - `src/server/actions/{initiatives,epics,tasks}.ts`에 `update*Status`/`update*Field` 류 경량 액션 추가(기존 `update*` 재사용 가능하면 재사용하되, 다이얼로그 없이 단일 필드만 patch).
  - 각 액션은 `requireUser` + `revalidatePath` + `logActivity`(가능하면 `status_changed`) 패턴 유지.

## 변경 파일(예상)

- 신규 `src/components/detail/property-bar.tsx` (+ inline select 컴포넌트)
- `src/app/(app)/initiatives/[id]/page.tsx`, `epics/[id]/page.tsx`, `tasks/[id]/page.tsx` — property bar 적용, 우측 세로 스택 정리
- `src/server/actions/initiatives.ts`, `epics.ts`, `tasks.ts` — 경량 상태/필드 액션

## 디자인 (DESIGN.md / docs/design-system.md 준수)

- near-white 라이트 테마 토큰만 사용(하드코딩 색 금지). 상태 색은 `constants.ts`의 STATUS/PRIORITY meta 사용.
- 깊이는 hairline/ring, 무거운 그림자 금지.

## 주의 (AGENTS.md)

이 Next.js는 breaking change가 있다. server action 정의/호출, `revalidatePath`, 클라이언트/서버 경계 사용 전 `node_modules/next/dist/docs/` 확인.

## 검증

- `npm run build` + `npm run lint`(신규 경고 없음).
- 3개 상세에서 상태/우선순위/담당자를 바에서 바로 바꾸면 반영되고, 새로고침 후 유지.
- 상태바가 한 줄로 나오고 좁은 화면에서 자연스럽게 wrap.
