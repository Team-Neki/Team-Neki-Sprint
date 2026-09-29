# 오라클 — 하위 태스크 진행률 롤업 (BACKEND-160)

이 문서는 에픽·프로젝트·스프린트 진행률 표시 작업의 완료 판정 기준을 다룹니다. 자동(auto) 항목은 `node_modules` 가 설치된 체크아웃에서 실행합니다. 수동(manual) 항목은 로그인이 Google OAuth 전용이라 배포 후 사람이 확인합니다.

설계는 [`docs/superpowers/specs/2026-09-30-task-progress-rollup-design.md`](../superpowers/specs/2026-09-30-task-progress-rollup-design.md) 를 참고합니다.

## 공통 (O-0)

| id | 종류 | 판정 | 명령/절차 |
|---|---|---|---|
| O-0-1 | auto | 타입 검사 0 에러 | `npx tsc --noEmit` 종료코드 0 |
| O-0-2 | auto | lint 0 에러 | `npx eslint src` 종료코드 0 |
| O-0-3 | auto | 유닛 테스트 전부 통과, 244 초과 | `npx vitest run` — "Tests N passed" 이고 N > 244 |
| O-0-4 | auto | 프로덕션 빌드 성공 | `npx next build` 종료코드 0 |
| O-0-5 | auto | 스키마 변경 없음 | `git diff main...HEAD --stat -- prisma/` 출력 없음 |
| O-0-6 | auto | 바이너리로 오인되는 파일 없음 | `git diff --stat main...HEAD \| grep -c " Bin "` 이 0 |

## O-A. 진행률 계산

| id | 종류 | 판정 |
|---|---|---|
| O-A-1 | auto | `npx vitest run src/lib/task-progress.test.ts` 통과. 0건→`null`, 모두 완료일 때만 100, 199/200→99 케이스 포함 |
| O-A-2 | auto | `src/server/queries.ts` 에 `mdByEpic` 정의가 없고(`grep -c "function mdByEpic"` = 0) `rollupByEpic`·`rollupByProject`·`rollupBySprint` 가 각각 정의됨 |

## O-B. 표 컬럼

| id | 종류 | 판정 |
|---|---|---|
| O-B-1 | auto | `epic-columns.tsx`·`project-columns.tsx`·`sprint-columns.tsx` 각각에 `key: "progress"` 가 1회, 그 컬럼에 `sortField` 없음 |
| O-B-2 | auto | 세 행 타입(`EpicTableRow`·`ProjectTableRow`·`SprintTableRow`)에 `progress: TaskProgress` 가 필수 필드로 존재(O-0-1 이 모든 호출부 공급을 보장) |
| O-B-3 | manual | /epics, /projects, /sprints 목록과 프로젝트 상세의 에픽 표, 스프린트 상세의 프로젝트 표에서 상태 뒤에 "진행률" 컬럼이 막대 + `완료/전체` 로 보인다. 태스크가 없는 행은 "—" |
| O-B-4 | manual | 프로젝트 상세 에픽 표와 스프린트 상세 프로젝트 표의 MD 컬럼에 값이 보인다(예상 MD 가 입력된 경우) |

## O-C. 상세 요약

| id | 종류 | 판정 |
|---|---|---|
| O-C-1 | auto | `src/app/(app)/{epics,projects,sprints}/[id]/page.tsx` 각각에서 `TaskProgressSummary` 를 1회 렌더 |
| O-C-2 | manual | 에픽 상세: 태스크 표 위에 막대 + `N% 태스크 T개 중 완료 a · 진행 중 b · 할 일 c` 가 보이고, 숫자가 표의 상태 뱃지 개수와 일치 |
| O-C-3 | manual | 프로젝트·스프린트 상세: 요약 숫자가 하위 행 진행률 셀 `완료/전체` 의 합과 일치 |
| O-C-4 | manual | 태스크 상태를 바꾸고 돌아오면 상위 상세 요약과 진행률 셀이 새 값으로 보인다(캐시 없음) |
| O-C-5 | manual | 모바일 폭(390px)에서 요약 줄이 줄바꿈되며 가로 스크롤을 만들지 않는다 |
