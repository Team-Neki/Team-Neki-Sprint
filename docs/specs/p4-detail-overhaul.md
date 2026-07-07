# Spec P4 — 상세 페이지 개편 (B3 + B7 MD + B8 업무 히스토리)

- **브랜치**: `feat/detail-overhaul` · **규모**: XL · **스키마**: additive(Task.estimatedMd/actualMd) · **한 스트림**(상세페이지·액션·쿼리 광범위 공유 → 내부 순차)

## B3 상세 페이지 인라인 편집화

대상: `src/app/(app)/{tasks,epics,projects}/[id]/page.tsx`

- **'수정' 버튼(다이얼로그 진입) 제거.** 모든 필드를 상세에서 **바로 인라인 편집**(진입 없이). 삭제(ConfirmDelete)는 유지.
- **레이아웃**: 왼쪽 = 제목(인라인 편집) + 설명(인라인 편집) + (태스크)댓글 + 업무 히스토리. 오른쪽 = 메타 카드(전 필드 인라인 편집).
- **상태를 오른쪽 메타 카드로 이동** — 현재 상단 `property-bar`(단일 라인)에서 우측 카드의 보고자/스토리포인트/에픽 옆으로. 상단 property-bar는 제거하거나 우측 카드로 흡수.
- **담당자 추가** — 태스크 우측 카드에 보고자와 함께 담당자 노출(둘 다 인라인 편집).
- 인라인 편집 컴포넌트: 기존 `property-bar`의 status/assignee/priority select 패턴 + `OptionSelect`(`components/selects/option-select.tsx`) 재사용. 제목=인라인 텍스트(blur/Enter 저장), 설명=인라인 textarea, 날짜=date input, MD/스토리포인트=number input. 모두 `useTransition`+`router.refresh()`(서버 확정 후 반영).
- **뒤로가기 스택 버그(back)**: 상세의 하드코딩 back 링크(`<Link href="/epics">` 등)를 재사용 `<BackButton fallback="...">`로 교체 — `window.history.length > 1` 이면 `router.back()`, 아니면 fallback. (타임라인→에픽→뒤로 시 타임라인으로.)

## B7 MD(맨데이) 트래킹

- **스키마(additive)**: `Task.estimatedMd Float?`, `Task.actualMd Float?`. Epic/Project는 **저장 안 함(계산)**.
- **편집은 태스크만**. 태스크 인라인 편집에 estimated/actual md 입력.
- **롤업(읽기전용)**: Epic md = 하위 태스크 md 합, Project md = 하위 에픽 md 합(= 프로젝트 하위 전 태스크 합). `getEpic`/`getProject`(및 목록 `getEpics`/`getProjects`)에서 집계(`prisma.task.aggregate`/groupBy 또는 include 합산).
- **표시**: 태스크 상세=estimated/actual 입력, 에픽/프로젝트 상세·목록=롤업 합 표시(예: `예상 12 / 실제 8 MD`).
- validators: `taskSchema`에 `estimatedMd`/`actualMd`(optional number, `z.coerce.number().min(0).nullish()`).
- 마이그레이션: `npx prisma migrate dev --name task_md` (additive, 리셋 아님, 로컬 dev DB). generate.

## B8 업무 히스토리 (변경 이력)

- 프로젝트/에픽/태스크 상세에 **댓글 옆(태스크) / 별도 섹션(에픽·프로젝트)** 업무 히스토리 노출. "누가 무엇을 변경" — 기한/상태/내용/담당자/우선순위 등.
- **기존 `Activity` 모델 활용**(entityType/entityId/action/meta/user). 신규 스키마 없음.
- **로깅 강화**: 인라인 편집(및 기존 update/set 액션)에서 **변경된 필드별 before→after를 `meta`에 기록**. 권장: 엔티티별 diff 로깅 헬퍼 — 현재 값 로드 → patch 적용 → 바뀐 필드마다 `logActivity({action:"field_changed", meta:{field, from, to}})`(또는 changes 배열). 상태 변경은 기존 `status_changed` 유지 가능.
- **조회**: `getEntityActivity(entityType, entityId, take?)` — 해당 엔티티 Activity 최신순 + user.
- **UI**: 히스토리 리스트(액터 아바타 + 한국어 문장 "X님이 기한을 A→B 로 변경" + 상대시간). 필드 라벨/값 포맷 헬퍼.

## 액션 설계(권장)

- 엔티티별 **generic patch + diff 로깅**: `updateTaskFields(id, patch)` / `updateEpicFields` / `updateProjectFields` — 현재 로드, 바뀐 필드만 update, 바뀐 필드별 Activity 기록, `revalidatePath`. 기존 `set*Status/Priority/Assignee`는 이 위로 통합하거나 유지(중복 로깅 주의). 팀/번호(불변)는 patch에서 제외.
- 인라인 편집기는 단일 필드 patch로 호출.

## 영향 파일(예상)
`prisma/schema.prisma`, `prisma/migrations/*`, `src/lib/validators.ts`, `src/server/queries.ts`(md 롤업 + getEntityActivity), `src/server/actions/{tasks,epics,projects}.ts`, `src/server/activity.ts`, `src/app/(app)/{tasks,epics,projects}/[id]/page.tsx`, `src/components/detail/property-bar.tsx`(제거/개편), 신규 인라인 편집기 + `components/detail/history-panel.tsx` + `components/detail/back-button.tsx`, 목록(`epics/page`,`projects/page`) md 표시.

## 주의(AGENTS.md)
이 Next.js는 breaking change 있음. server action·`revalidatePath`·params/searchParams(Promise) 작성 전 `node_modules/next/dist/docs/` 확인. 디자인은 DESIGN.md/near-white 토큰(하드코딩 색 금지), 상태/우선순위 색은 `constants.ts` meta.

## 검증(worktree)
- `npx prisma migrate dev --name task_md`(additive, 로컬 dev DB; AI 가드 걸리면 로컬·additive 근거로 consent env) → `npx prisma generate` → `npx tsc --noEmit` clean → `npx eslint src` 신규 0(repo lint clean 유지). `next build`/`dev`는 worktree에서 금지 — 병합 후 main.

## Finish
`feat/detail-overhaul`에 커밋. 메시지 끝 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 최종 보고: 변경 파일, 마이그레이션/generate 결과, tsc/eslint, 레이아웃/액션 설계 결정, 미결/불확실.
