# 오라클 — 코드 구조 개선 묶음 (BACKEND-179~193)

이 문서는 [구조 개선 계획](../superpowers/plans/2026-10-04-structure-fixes.md)의 완료 판정 기준입니다. auto 는 명령이 판정하고, manual 은 배포 후 사람이 확인합니다. 명령은 레포 루트에서 그대로 실행합니다.

## 공통 (O-0)

| id | 종류 | 판정 | 명령/절차 |
|---|---|---|---|
| O-0-1 | auto | 타입 검사 0 에러 | `npx tsc --noEmit` 종료코드 0 |
| O-0-2 | auto | lint 0 에러 | `npx eslint src` 종료코드 0 |
| O-0-3 | auto | 테스트 전부 통과, 수 ≥ baseline 257 | `npx vitest run` |
| O-0-4 | auto | 프로덕션 빌드 성공(메인 체크아웃) | `npx next build` 종료코드 0 |
| O-0-5 | auto | 바이너리 오인 파일 없음 | `git diff --stat origin/main...HEAD \| grep -c " Bin "` = 0 |
| O-0-6 | auto | 스키마 변경 없음 | `git diff origin/main...HEAD --stat -- prisma/` 출력 없음 |
| O-0-7 | auto | 추가 줄에 NUL·이모지 없음 | `git diff origin/main...HEAD \| python3 -c "import sys,re; print(sum(1 for l in sys.stdin if l.startswith('+') and re.search('[\x00\U0001F300-\U0001FAFF☀-➿]', l)))"` = 0 |

## O-A. 위키 제안 팝업 즉시 닫힘 (BACKEND-179)

| id | 종류 | 판정 |
|---|---|---|
| O-A-1 | auto | `grep -c "useCallback" src/components/wiki/block-handle.tsx` ≥ 1 |
| O-A-2 | auto | `grep -cE "onNodeChange=\{\(" src/components/wiki/block-handle.tsx` = 0 |
| O-A-3 | manual | 위키 편집 모드에서 `@` 입력 후 글자를 이어 치면 멤버 팝업이 유지되며 필터된다. `#`(티켓)·`/`(슬래시)도 같다 |

## O-K. 연결 위키 휴지통 + 이슈키 파서 (BACKEND-180)

| id | 종류 | 판정 |
|---|---|---|
| O-K-1 | auto | `sed -n '/export async function getEntityWikiLinks/,/^}/p' src/server/queries.ts \| grep -c "deletedAt: null"` = 3 |
| O-K-2 | auto | `sed -n '/^export function getTask(/,/^}/p' src/server/queries.ts \| grep -c "deletedAt: null"` ≥ 1 |
| O-K-3 | auto | `grep -cF '[A-Za-z0-9]+)-(\d+)' src/server/queries.ts` = 0 |
| O-K-4 | auto | `grep -c "parseIssueKey" src/server/queries.ts` ≥ 2 |
| O-K-5 | manual | 태스크에 위키를 연결한 뒤 그 위키를 휴지통으로 보내면 태스크 상세 '연결된 위키'에서 사라진다(에픽·프로젝트·스프린트 동일) |

## O-P. 페이지별 인증 (BACKEND-181)

| id | 종류 | 판정 |
|---|---|---|
| O-P-1 | auto | `grep -c "cache(" src/lib/session.ts` ≥ 1 |
| O-P-2 | auto | `grep -L "requireUser" "src/app/(app)/board/page.tsx" "src/app/(app)/labels/page.tsx" "src/app/(app)/timeline/page.tsx" "src/app/(app)/tasks/[id]/page.tsx" "src/app/(app)/epics/[id]/page.tsx" "src/app/(app)/sprints/[id]/page.tsx"` 출력 없음 |
| O-P-3 | manual | 로그인 상태에서 보드·라벨·타임라인·상세·슬라이드 상세가 전과 같이 열린다 |

## O-S1. Core 서비스 분리 (BACKEND-182)

| id | 종류 | 판정 |
|---|---|---|
| O-S1-1 | auto | `grep -rnE "^export async function [A-Za-z]+Core" src/server/actions` 출력 없음 |
| O-S1-2 | auto | `grep -rn "@/server/actions" src/app/api/mcp` 출력 없음 |
| O-S1-3 | auto | `grep -l '"use server"' src/server/services/*.ts` 출력 없음 |
| O-S1-4 | auto | `npx vitest run src/app/api/mcp` 통과 |

## O-S2. 다이얼로그 수정 경로 통합 (BACKEND-183)

| id | 종류 | 판정 |
|---|---|---|
| O-S2-1 | auto | `sed -n '/export async function updateTask(/,/^}/p' src/server/actions/tasks.ts \| grep -c "FieldsCore"` ≥ 1 |
| O-S2-2 | auto | `sed -n '/export async function updateEpic(/,/^}/p' src/server/actions/epics.ts \| grep -c "FieldsCore"` ≥ 1 |
| O-S2-3 | auto | `sed -n '/export async function updateProject(/,/^}/p' src/server/actions/projects.ts \| grep -c "FieldsCore"` ≥ 1 |
| O-S2-4 | auto | `sed -n '/export async function updateSprint(/,/^}/p' src/server/actions/sprints.ts \| grep -c "FieldsCore"` ≥ 1 |
| O-S2-5 | manual | 태스크 수정 다이얼로그로 상태·담당자를 바꾸면 히스토리 탭에 필드별 변경이 남고, 설명에 넣은 @멘션 대상에게 알림이 간다 |

## O-S3. 트랜잭션·충돌 검사·MCP 위키 생성 (BACKEND-184)

| id | 종류 | 판정 |
|---|---|---|
| O-S3-1 | auto | `grep -c '\$transaction' src/server/services/wiki.ts` ≥ 1 |
| O-S3-2 | auto | `grep -c "updateMany" src/server/services/wiki.ts` ≥ 1 |
| O-S3-3 | auto | `grep -c '\$transaction' src/server/services/comments.ts` ≥ 1 |
| O-S3-4 | auto | `grep -c "updateWikiContentCore" src/app/api/mcp/v1/wiki/route.ts` = 0 |
| O-S3-5 | manual | 같은 위키를 두 탭에서 편집해 차례로 저장하면 늦은 쪽에 충돌 안내가 뜬다 |

## O-S4. 위키 초안·휴지통 가드 (BACKEND-185)

| id | 종류 | 판정 |
|---|---|---|
| O-S4-1 | auto | `npx vitest run src/app/api/mcp/v1/wiki` 통과 |
| O-S4-2 | auto | `grep -c "isDraft" "src/app/api/mcp/v1/wiki/[id]/route.test.ts"` ≥ 1 |
| O-S4-3 | auto | `sed -n '/export async function updateWikiContentCore/,/^}/p' src/server/services/wiki.ts \| grep -c "deletedAt"` ≥ 1 |
| O-S4-4 | manual | 다른 사람 초안 id 로 MCP `get_wiki_page` → 찾을 수 없음 |

## O-B. 보드 중간값 정렬 (BACKEND-186)

| id | 종류 | 판정 |
|---|---|---|
| O-B-1 | auto | `grep -c "export function orderBetween" src/lib/order.ts` = 1 |
| O-B-2 | auto | `npx vitest run src/lib/order.test.ts` 통과 |
| O-B-3 | auto | `sed -n '/export async function reorderBoardTask/,/^}/p' src/server/actions/tasks.ts \| grep -c "orderBetween"` ≥ 1 |
| O-B-4 | manual | 보드에서 같은 컬럼 내 이동, 컬럼 간 이동, 필터를 켠 채 이동 후 새로고침해도 순서가 유지된다 |

## O-W1. 위키 에디터 공용 훅 (BACKEND-187)

| id | 종류 | 판정 |
|---|---|---|
| O-W1-1 | auto | `test -f src/components/wiki/use-wiki-editor.ts` 종료코드 0 |
| O-W1-2 | auto | `grep -c "useWikiEditor" src/components/wiki/editor.tsx` ≥ 1 |
| O-W1-3 | auto | `grep -c "useWikiEditor" src/components/announcements/announcement-editor.tsx` ≥ 1 |
| O-W1-4 | auto | `grep -c "UploadPlaceholder" src/components/wiki/use-wiki-editor.ts` ≥ 1 |
| O-W1-5 | auto | `grep -c "useMemo" src/components/wiki/wiki-view.tsx` ≥ 1 |
| O-W1-6 | manual | `ANNOUNCEMENTS_ENABLED=true` 에서 공지 편집 중 이미지 붙여넣기·PDF 드롭 → 본문에 삽입되고 페이지를 떠나지 않는다 |

## O-W2. editor.tsx 분리 (BACKEND-188)

| id | 종류 | 판정 |
|---|---|---|
| O-W2-1 | auto | `ls src/components/wiki/editor-toolbar.tsx src/components/wiki/bubble-toolbar.tsx src/components/wiki/table-hover-controls.tsx` 종료코드 0 |
| O-W2-2 | auto | `wc -l < src/components/wiki/editor.tsx` ≤ 650 |
| O-W2-3 | auto | `grep -rl "function applyLink" src/components/wiki \| wc -l` = 1 |
| O-W2-4 | auto | [위키 편집 화면 사용성 오라클](./wiki-editor-usability.md)의 auto 항목 명령이 전부 통과 |
| O-W2-5 | manual | 툴바 각 버튼, 버블 툴바 링크 적용, 표 hover 행·열 추가가 전과 같다 |

## O-M. 댓글 중복 전송 방지 (BACKEND-189)

| id | 종류 | 판정 |
|---|---|---|
| O-M-1 | auto | `grep -c "submittingRef" src/components/wiki/wiki-comments-view.tsx` ≥ 2 |
| O-M-2 | auto | `grep -c "submittingRef" src/components/wiki/wiki-page-comments.tsx` ≥ 2 |
| O-M-3 | auto | `grep -c "submittingRef" src/components/wiki/comment-thread-card.tsx` ≥ 2 |
| O-M-4 | auto | `grep -c "useMemo" src/components/wiki/wiki-comments-view.tsx` ≥ 1 |
| O-M-5 | manual | 인라인 댓글·페이지 댓글·답글 입력에서 Cmd+Enter 를 빠르게 세 번 → 하나만 생긴다 |

## O-G. 제안 메뉴 공용화 (BACKEND-190)

| id | 종류 | 판정 |
|---|---|---|
| O-G-1 | auto | `test -f src/components/wiki/suggestion-menu.tsx` 종료코드 0 |
| O-G-2 | auto | `grep -c "scrollIntoView" src/components/wiki/suggestion-menu.tsx` ≥ 1 |
| O-G-3 | auto | `grep -l "suggestion-menu" src/components/wiki/ticket-mention.tsx src/components/wiki/person-mention.tsx src/components/wiki/slash-menu.tsx \| wc -l` = 3 |
| O-G-4 | manual | `/` 메뉴에서 ↓ 를 10번 눌러도 선택 항목이 보이고, `@`·`#`·`/` 선택 후 Enter 삽입이 전과 같다 |

## O-L. 목록 필터 공용화 (BACKEND-191)

| id | 종류 | 판정 |
|---|---|---|
| O-L-1 | auto | `npx vitest run src/lib/list-filters.test.ts` 통과 |
| O-L-2 | auto | `grep -rl "parseListFilters" "src/app/(app)" \| wc -l` ≥ 5 |
| O-L-3 | auto | `grep -rn "const toArray" "src/app/(app)"` 출력 없음 |
| O-L-4 | auto | `grep -c "sprint?: string" "src/app/(app)/projects/page.tsx"` = 0 |
| O-L-5 | manual | `/tasks?status=foo` 가 에러 없이 목록을 보여 준다. 태스크 필터 초기화 후 정렬이 유지된다. 검색어 입력 중 요청이 매 글자 나가지 않는다 |

## O-F. 필드 저장 훅 + InlineDescription 분리 (BACKEND-192)

| id | 종류 | 판정 |
|---|---|---|
| O-F-1 | auto | `test -f src/components/detail/use-field-save.ts && test -f src/components/detail/inline-description.tsx` 종료코드 0 |
| O-F-2 | auto | `grep -c "RichEditor" src/components/detail/inline-fields.tsx` = 0 |
| O-F-3 | auto | `grep -c "useOptimisticValue" src/components/detail/inline-assignee.tsx` ≥ 1 |
| O-F-4 | auto | `grep -c "useOptimisticValue" src/components/detail/epic-field.tsx` ≥ 1 |
| O-F-5 | manual | 태스크 목록에서 담당자를 바꾸면 refresh 동안에도 새 값이 바로 보인다 |

## O-Q. 상세 셸 공용화 (BACKEND-193)

| id | 종류 | 판정 |
|---|---|---|
| O-Q-1 | auto | `test -f src/components/detail/detail-shell.tsx` 종료코드 0 |
| O-Q-2 | auto | `grep -l "detail-shell" "src/app/(app)/tasks/[id]/page.tsx" "src/app/(app)/epics/[id]/page.tsx" "src/app/(app)/projects/[id]/page.tsx" "src/app/(app)/sprints/[id]/page.tsx" \| wc -l` = 4 |
| O-Q-3 | manual | 에픽 상세의 프로젝트, 프로젝트 상세의 스프린트를 눌러 부모 상세로 이동하고, 변경도 할 수 있다. 네 상세의 헤더·설명·하위 목록이 전과 같게 보인다 |

## O-R. 릴리스 (사용자 승인 후)

| id | 종류 | 판정 |
|---|---|---|
| O-R-1 | auto | `gh pr view <n> --json state --jq .state` = `MERGED` |
| O-R-2 | auto | `gh run list --workflow deploy-prod.yml --limit 1 --json conclusion --jq '.[0].conclusion'` = `success` |
| O-R-3 | auto | 티켓 BACKEND-179~193 전부 DONE |

## 판정 규칙

- auto 하나라도 실패 = 미완료.
- manual 은 PR 본문에 "브라우저 미검증" 으로 목록화하고, 실패 시 티켓을 다시 연다.
- auto 전부 통과 = 에이전트 측 완료. manual 통과 = 기능 완료.
