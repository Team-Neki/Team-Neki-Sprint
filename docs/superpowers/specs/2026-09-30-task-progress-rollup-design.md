# 하위 태스크 진행률 롤업 설계 (BACKEND-160)

## 문제

에픽·프로젝트·스프린트 상세의 하위 표에는 행마다 상태 뱃지가 있지만, 하위 항목 전체가 얼마나 끝났는지는 한눈에 보이지 않는다. 표를 세어 봐야 알고, 프로젝트나 스프린트는 손자 계층(태스크)까지 내려가 봐야 알 수 있다.

## 결정

| 항목 | 결정 |
|---|---|
| 표시 형태 | 상세 상단 요약 + 표 행별 진행률 컬럼 둘 다 |
| 집계 단위 | 최하위 태스크까지 롤업. 에픽=하위 태스크, 프로젝트=하위 에픽들의 태스크, 스프린트=하위 프로젝트→에픽의 태스크 |
| 적용 화면 | 에픽·프로젝트·스프린트 상세, 그리고 컬럼 정의를 공유하는 목록(/epics, /projects, /sprints) |
| 진행률 정의 | 완료 태스크 / 전체 태스크, 내림(`floor`). 모두 완료일 때만 100%. 진행 중은 막대 구간으로만 보이고 %에는 포함하지 않음 |
| 0건 | 요약은 "태스크 없음", 표 셀은 "—" |
| 정렬 | 진행률 컬럼은 정렬 대상 아님(롤업 계산값은 정렬 제외 원칙) |

## 설계

### 순수 로직 — `src/lib/task-progress.ts`

- `TaskProgress = Record<Status, number>` (TODO·IN_PROGRESS·DONE 개수)
- `EMPTY_PROGRESS`, `countStatuses(items)`, `sumProgress(list)`, `progressTotal(p)`, `progressPercent(p)`(0건이면 `null`)
- vitest 로 경계값 검증(0건, 1/3, 2/3, 99.x% 가 100 으로 올라가지 않음)

### 데이터 — `src/server/queries.ts`

기존 MD 롤업 쿼리를 상태까지 묶어 한 번에 집계하도록 바꾼다. 스키마 변경 없음, 캐시 없음(gotchas §13).

| 헬퍼 | 방식 | 사용처 |
|---|---|---|
| `rollupByEpic(ids)` | `task.groupBy({ by: ["epicId","status"] })` + `_sum`·`_count` | `getEpics`(목록), `getProject`(상세의 에픽 행). 기존 `mdByEpic` 대체 |
| `rollupByProject(ids)` | raw SQL `GROUP BY e."projectId", t.status` | `getProjects`(목록), `getSprint`(상세의 프로젝트 행) |
| `rollupBySprint(ids)` | raw SQL `GROUP BY p."sprintId", t.status` | `getSprints`(목록) |

세 헬퍼는 `(key, status, count, estimated, actual)` 행을 같은 fold 로 `Map<key, { md, progress }>` 로 접는다. 에픽 상세(`getEpic`)는 이미 로드한 태스크로 `countStatuses` 를 쓴다. 프로젝트·스프린트 상세의 상위 합계는 하위 행 progress 의 합이다.

부수 효과로 프로젝트 상세의 에픽 표와 스프린트 상세의 프로젝트 표에 `estimatedMd` 가 채워진다. 지금까지는 "하위목록에선 생략"으로 주석 처리돼 MD 컬럼이 항상 "—" 였는데, 같은 집계에서 값이 공짜로 나오므로 채운다.

MCP API 라우트는 쿼리 결과에서 필드를 골라 내보내므로 응답이 바뀌지 않는다.

### UI — `src/components/detail/task-progress.tsx`

- `TaskProgressSummary`: 상세의 하위 목록 헤더와 표 카드 사이. `[막대] 40% 태스크 10개 중 완료 4 · 진행 중 3 · 할 일 3`
- `TaskProgressCell`: 표 셀. `[작은 막대] 4/10`
- 막대: 트랙 `bg-muted`(#f5f5f5, inset 면), 완료 `STATUS_META.DONE.dot`(emerald), 진행 중 `STATUS_META.IN_PROGRESS.dot`(amber). 새 색 없음. `role="progressbar"` + `aria-valuenow`
- 서버 컴포넌트에서 그대로 렌더(훅 없음)

### 컬럼

`EPIC_COLUMNS`·`PROJECT_COLUMNS`·`SPRINT_COLUMNS` 의 상태 컬럼 바로 뒤에 `{ key: "progress", label: "진행률" }`. 행 타입에 `progress: TaskProgress` 를 필수로 추가해 모든 호출부가 값을 넘기는지 타입 검사로 보장한다. 컬럼 설정을 저장한 사용자에게는 기존 머지 규칙(`resolveColumns`)대로 맨 뒤에 붙는다.

## 검증

완료 판정은 [`docs/oracle/task-progress-rollup.md`](../../oracle/task-progress-rollup.md).

## 범위 밖

- 진행률 정렬, 필터
- 대시보드·타임라인·보드 표시
- 태스크 가중치(MD 기반 진행률)
