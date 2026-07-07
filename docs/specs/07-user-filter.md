# Spec #7 — 사용자 단위 필터링

- **브랜치**: `feat/user-filter`
- **규모**: M · **스키마 변경**: 없음

## 배경

필터는 태스크 목록에만 존재(`src/components/tasks/task-filters.tsx` — 상태/담당자/검색, URL searchParams 기반). 이니셔티브·에픽·보드에는 사용자 필터가 없다.

## 결정된 접근

- 기존 태스크 필터 방식과 **동일하게 URL searchParams** 사용(`?owner=<id>` 등). 서버 컴포넌트에서 `searchParams`를 읽어 쿼리에 전달.
- **이니셔티브/에픽 목록**: 오너(owner) 기준 사용자 필터 추가.
  - `src/server/queries.ts`의 `getInitiatives`/`getEpics`에 `ownerId?` 파라미터 추가.
  - 목록 페이지(`initiatives/page.tsx`, `epics/page.tsx`)에 필터 UI 추가.
- **보드**: 담당자(assignee) 필터 추가(`board/page.tsx` + `getTasks`는 이미 `assigneeId` 지원).
- 가능하면 사용자 선택 UI를 **공용 필터 컴포넌트**로 일반화(멤버 목록 + Select). 무리하면 페이지별로 두되 `task-filters` 패턴을 재사용.

## 변경 파일(예상)

- `src/server/queries.ts` (getInitiatives/getEpics에 ownerId 필터)
- `src/app/(app)/initiatives/page.tsx`, `epics/page.tsx`, `board/page.tsx`
- 신규 공용 필터 컴포넌트(예: `src/components/filters/owner-filter.tsx`) 또는 기존 패턴 재사용

## 비고

- 4번(유저 그룹) 완료 시 "그룹으로 필터"를 이 위에 얹을 예정 — 확장 가능하게 설계.
- `getTasks`의 기존 필터/시그니처는 **깨지 않게** 파라미터를 optional 추가만.

## 주의 (AGENTS.md)

server component의 `searchParams`는 이 Next 버전에서 Promise다(기존 코드가 `await searchParams` 사용 중). 동일 패턴을 따르고, 확신이 없으면 `node_modules/next/dist/docs/` 확인.

## 검증

- `npm run build` + `npm run lint`(신규 경고 없음).
- 각 목록에서 사용자 선택 시 URL이 바뀌고 결과가 필터됨. 필터 해제 동작 확인.
