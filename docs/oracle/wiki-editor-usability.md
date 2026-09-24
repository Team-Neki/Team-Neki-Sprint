# 오라클 — 위키 편집 화면 사용성 개선 (BACKEND-144 ~ 149)

이 문서는 위키 편집 화면 개선 작업의 완료 판정 기준을 다룹니다. 각 항목은 "이 조건이 성립하면 완료" 를 기계적으로 판정할 수 있게 적었고, 자동(auto)과 수동(manual)을 구분했습니다. 자동 항목은 `node_modules` 가 설치된 main 체크아웃에서 실행합니다. 수동 항목은 로그인이 Google OAuth 전용이라 에이전트가 실행할 수 없으므로 배포 후 사람이 확인합니다.

구현 계획은 [`docs/superpowers/plans/2026-09-25-wiki-editor-usability.md`](../superpowers/plans/2026-09-25-wiki-editor-usability.md) 를 참고합니다.

## 공통 (O-0)

| id | 종류 | 판정 | 명령/절차 |
|---|---|---|---|
| O-0-1 | auto | 타입 검사 0 에러 | `npx tsc --noEmit` 종료코드 0 |
| O-0-2 | auto | lint 0 에러 | `npx eslint src` 종료코드 0 |
| O-0-3 | auto | 유닛 테스트 전부 통과, 테스트 수가 baseline(작업 전) 이상 | `npx vitest run` — "Tests N passed" 이고 N ≥ baseline |
| O-0-4 | auto | 프로덕션 빌드 성공 | `npx next build` 종료코드 0 (main 체크아웃, worktree 아님) |
| O-0-5 | auto | 바이너리로 오인되는 파일 없음 | `git diff --stat main...HEAD \| grep -c " Bin "` 이 0 |
| O-0-6 | auto | 스키마 변경 없음 | `git diff main...HEAD --stat -- prisma/` 출력 없음 |
| O-0-7 | auto | 코드 산출물에 이모지 없음 | `git diff main...HEAD \| grep -P "^\+.*[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]"` 출력 없음 |

## O-A. 툴바 활성 상태 동기화 + 편집 상태 격리 (BACKEND-144)

| id | 종류 | 판정 |
|---|---|---|
| O-A-1 | auto | `src/components/wiki/editor.tsx` 와 `src/components/announcements/announcement-editor.tsx` 의 `useEditor({` 블록 안에 `shouldRerenderOnTransaction: true` 가 각각 1회 존재. `grep -c "shouldRerenderOnTransaction: true" <file>` = 1 |
| O-A-2 | auto | `src/app/(app)/wiki/[id]/page.tsx` 의 `<WikiDetail` 시작 태그에 `key={page.id}` 존재 |
| O-A-3 | manual | 굵은 텍스트를 마우스로 드래그 선택(타이핑 없이)하면 툴바 "굵게" 가 눌린 상태로 표시된다. 선택을 일반 텍스트로 옮기면 즉시 풀린다 |
| O-A-4 | manual | 표 안을 클릭만 한 뒤(편집 없이) 툴바 "표" 를 누르면 행·열 편집 메뉴가 뜬다(새 표 크기 그리드가 아님) |
| O-A-5 | manual | 페이지 A 에서 "수정" 후 사이드바로 페이지 B 를 열면 B 는 읽기 뷰로 열린다 |

## O-B. 본문 폭 통일 (BACKEND-145)

| id | 종류 | 판정 |
|---|---|---|
| O-B-1 | auto | `editor.tsx` 의 `WikiEditor` 루트 div 클래스가 `mx-auto max-w-5xl`. `grep -c 'className="mx-auto max-w-3xl"' src/components/wiki/editor.tsx` = 0 |
| O-B-2 | manual | "수정" 클릭 전후로 본문 줄바꿈 위치가 바뀌지 않는다(데스크톱 1280px 이상) |
| O-B-3 | manual | 편집 중 긴 본문을 스크롤해도 툴바 상단과 헤더 하단 사이로 본문 글자가 비치지 않는다. 비치면 `Toolbar` 의 `top-14` 를 헤더 실측 높이로 보정(후속) |

## O-C. 저장·임시저장 흐름 안전장치 (BACKEND-146)

| id | 종류 | 판정 |
|---|---|---|
| O-C-1 | auto | `src/server/actions/wiki.ts` 의 `updateWikiContent` 시그니처에 `expectedUpdatedAt` 인자가 있고 함수 본문에 `{ conflict: true }` 반환이 존재 |
| O-C-2 | auto | `editor.tsx` 에 `useTransition` import 및 사용, `draftGenRef` 사용, `ConfirmDelete` import 이 존재 |
| O-C-3 | auto | `editor.tsx` 의 배너 JSX 조건이 `usingDraft` 가 아닌 별도 state(`showDraftBanner`) 를 참조 |
| O-C-4 | auto | `wiki-detail.tsx` 의 상태 텍스트 span 클래스에 `hidden` 과 `sm:inline` 이 없음 |
| O-C-5 | manual | 임시저장본 없이 편집 진입 → 타이핑 → 2초 대기: "임시 저장본을 불러왔습니다" 배너가 뜨지 않고 헤더 상태만 "임시저장됨" 으로 바뀐다 |
| O-C-6 | manual | 타이핑 직후(1초 이내) Cmd+S 로 저장 → 뷰 복귀 → 새로고침: 편집 모드로 자동 진입하지 않는다(유령 임시저장본 없음). 10회 반복 |
| O-C-7 | manual | 편집 후 "취소" 클릭 시 확인 다이얼로그가 뜨고, "버리기" 를 눌러야 뷰로 돌아간다. 편집하지 않았으면 다이얼로그 없이 바로 돌아간다 |
| O-C-8 | manual | 창 두 개에서 같은 페이지를 편집, 창 1 저장 후 창 2 저장: 창 2 에 "다른 사용자가 먼저 저장했습니다" 토스트가 뜨고 편집 모드가 유지되며 창 1 의 저장이 덮어써지지 않는다 |
| O-C-9 | manual | 저장 클릭 후 뷰로 바뀌는 순간 이전 본문이 잠깐 보이지 않는다(저장 버튼이 잠시 비활성 상태로 머문 뒤 새 본문이 보인다) |
| O-C-10 | manual | 모바일 폭(390px)에서 편집 중 헤더에 "임시저장 대기"/"저장 중…" 이 보인다 |

## O-D. 링크 입력 정규화 (BACKEND-147)

| id | 종류 | 판정 |
|---|---|---|
| O-D-1 | auto | `npx vitest run src/components/wiki/link-href.test.ts` 통과(최소 4개 describe 케이스) |
| O-D-2 | auto | `editor.tsx` 에 `type="url"` 이 0회. `grep -c 'type="url"' src/components/wiki/editor.tsx` = 0 |
| O-D-3 | auto | `editor.tsx` 가 `normalizeHref` 를 2회 이상 호출(툴바·버블) |
| O-D-4 | manual | 텍스트 선택 → 버블 링크 → `example.com` 입력 → Enter: 링크가 `https://example.com` 으로 걸린다. 뷰 모드에서 클릭하면 새 탭으로 열린다 |
| O-D-5 | manual | 버블 링크 입력 중 Esc 를 누르면 링크 입력이 닫히고 서식 메뉴로 돌아간다(선택 유지) |

## O-F. 파일 업로드 경로 확장 (BACKEND-148)

| id | 종류 | 판정 |
|---|---|---|
| O-F-1 | auto | `src/components/wiki/upload.ts` 가 `uploadAndInsertImages`, `uploadAndInsertFiles`, `uploadAndInsertAny`, `pickFiles`, `splitFiles` 를 export. `editor.tsx` 에 `async function uploadImage` 정의가 없음(이동 완료) |
| O-F-2 | auto | `npx vitest run src/components/wiki/upload.test.ts src/components/wiki/upload-placeholder.test.ts src/components/wiki/slash-commands.test.ts` 통과 |
| O-F-3 | auto | `editor.tsx` `handleDrop` 이 `imageFilesFrom` 을 쓰지 않고, 파일이 하나라도 있으면 `return true` |
| O-F-4 | auto | `slash-commands.ts` 의 `SLASH_COMMANDS` 에 `key: "image"` 와 `key: "file"` 존재 |
| O-F-5 | auto | `file-attachment.tsx` 의 `<a>` 에 `editor.isEditable` 기반 `preventDefault` 존재. `globals.css` 에 `.wiki-file-block.ProseMirror-selectednode` 규칙 존재 |
| O-F-6 | manual | 편집 중 PDF 를 본문에 드롭: 페이지가 이탈하지 않고 "파일 업로드 중…" 이 드롭 위치에 표시된 뒤 다운로드 칩이 그 자리에 생긴다. SVG 를 드롭하면 "첨부할 수 없는 파일 형식입니다" 토스트가 뜨고 문서는 변하지 않는다 |
| O-F-7 | manual | PNG 와 PDF 를 함께 드롭: 이미지는 이미지로, PDF 는 칩으로 각각 삽입된다 |
| O-F-8 | manual | Finder 에서 PDF 복사 → 본문에 붙여넣기: 칩이 커서 위치에 삽입된다 |
| O-F-9 | manual | `/파일` 입력 → Enter: OS 파일 선택 창이 열리고, 두 개 선택 시 칩 두 개가 순서대로 삽입된다. 창을 취소하면 문서가 변하지 않는다 |
| O-F-10 | manual | 편집 모드에서 칩을 클릭하면 다운로드가 시작되지 않고 칩이 선택 표시(외곽선)된다. Backspace 로 삭제된다. 뷰 모드에서 클릭하면 원본 파일명으로 다운로드된다 |
| O-F-11 | manual | 툴바 클립 버튼으로 파일 3개 선택: 3개 모두 칩으로 삽입된다 |

## O-J. prod 인그레스 본문 상한 (BACKEND-149)

| id | 종류 | 판정 |
|---|---|---|
| O-J-1 | auto | `gh api repos/Team-Neki/Team-Neki-GitOps/contents/overlays/prod/sprint-ingressroute-https.yaml --jq .content \| base64 -d` 결과가 `kind: IngressRoute`(Traefik) 이고 `middlewares:` 항목이 없음 → Traefik 기본값은 본문 크기 무제한이므로 변경 불필요 |
| O-J-2 | manual | 배포 후 prod 위키에서 20MB PDF 첨부가 성공한다(413 아님) |

2026-09-25 확인 결과: O-J-1 성립. `sprint-ingressroute-https.yaml` 은 `entryPoints: websecure`, `Host(sprint.suitestudy.com)` 라우트 하나에 미들웨어가 없습니다. nginx ingress 의 1MB 기본 제한 우려는 해당하지 않습니다.

## O-R. 릴리스

| id | 종류 | 판정 |
|---|---|---|
| O-R-1 | auto | PR 이 main 에 머지됨: `gh pr view <n> --json state --jq .state` = `MERGED` |
| O-R-2 | auto | Deploy to Prod 워크플로 실행이 성공: `gh run list --workflow deploy-prod.yml --limit 1 --json conclusion --jq '.[0].conclusion'` = `success` |
| O-R-3 | auto | 배포 후 헬스 응답: `curl -s -o /dev/null -w "%{http_code}" https://sprint.suitestudy.com:4641/api/health` = 200 |
| O-R-4 | auto | 티켓 BACKEND-144~148 상태 DONE, 149 DONE |

## 판정 규칙

- auto 항목이 하나라도 실패하면 미완료입니다.
- manual 항목은 배포 후 사람이 확인합니다. PR 본문에 "브라우저 미검증" 으로 목록을 남기고, 실패 항목은 같은 티켓을 재오픈합니다.
- 정리하면, **auto 전부 통과 + PR 머지 + 배포 성공이 에이전트 측 완료 조건이고, manual 통과가 기능 완료 조건입니다.**
