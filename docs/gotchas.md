# 엔지니어링 주의사항 / 함정 (Gotchas)

이 프로젝트에서 실제로 물렸던 함정과 그 해결법. 새 작업 전에 훑어보면 같은 실수를 피할 수 있다. (2026-07-08 세션 기준 축적)

## 1. Prisma / dev 서버

- **스키마 변경 후 dev 서버 반드시 재시작.** 오래 켜둔 `next dev`는 시작 시점의 **옛 generated Prisma client를 메모리에 물고** 있다. `migrate` + `generate` 후에도 재시작 전엔 `prisma.<model>.findMany is not a function` / `prisma.<model>` undefined 같은 런타임 에러가 난다. **주의: 이건 "DB 연결 오류"처럼 보이지만 아니다** — 실제 사례에서 `prisma.project`가 undefined였고 원인은 스테일 프로세스였다(마이그레이션·DB·빌드는 정상).
- **병합 후 `npx prisma generate` 필요.** 스키마 변경 브랜치를 main에 병합하면, main의 client가 자동 재생성되지 않아 `Property 'X' does not exist on PrismaClient` 타입 에러가 난다. 병합 직후 `npx prisma generate` 실행.
- **`prisma migrate reset`은 AI 가드에 막힌다.** 에이전트/비대화 실행에서 Prisma가 위험 작업으로 차단. **로컬 dev DB임을 확인**한 뒤 `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=1`로만 진행. **additive `migrate dev`는 가드에 안 걸린다**(데이터 손실 없음).
- **additive vs reset**: 컬럼/테이블 추가는 additive(`migrate dev --name ...`)로 — 기존 데이터·운영 중 앱에 무해. 리셋은 데이터 소실.

## 2. git worktree + JS 프로젝트 (병렬 작업 시 반복적으로 물림)

- **Turbopack은 symlink된 node_modules를 거부한다.** worktree의 `node_modules`를 루트로 symlink하면 `next build`/`next dev`가 `Symlink [project]/node_modules is invalid, it points out of the filesystem root`로 패닉. → **worktree 검증은 `npx tsc --noEmit` + `npx eslint`로만**, 통합 `next build`는 병합 후 **main(실제 node_modules)** 에서 1회.
- **worktree에서 `npm install`한 새 의존성은 물리 설치가 누락될 수 있다.** symlink node_modules 탓에 `package.json`/lock만 갱신되고 실제 패키지가 안 깔림 → 병합 후 통합 빌드가 `Module not found`. **해결: 의존성 추가 스트림 병합 후 main에서 `npm install`.**
- **worktree의 `prisma generate`는 공유 client를 덮어쓴다.** 여러 worktree가 node_modules를 공유하므로, 스키마 변경 스트림은 서로/메인에 영향. additive면 대체로 무해(메인은 병합 전까지 새 모델 미사용)하지만, **스키마 변경은 되도록 main 체크아웃에서 순차 처리**가 안전.
- **eslint가 `.worktrees/`까지 스캔한다.** `npm run lint` 결과가 worktree 사본 때문에 부풀려짐(중복·미완성 코드). 경로로 필터(`grep -v .worktrees`)하거나 worktree 정리 후 lint. (`eslint.config.mjs`에 `.worktrees` ignore 추가 고려.)

### 병렬 스트림 원칙(요약)
- **스키마 없음 + 파일 격리** → worktree 병렬 OK(tsc/eslint 검증).
- **스키마 변경 / 공유 파일(editor·validators·queries) 다수** → main에서 순차, 또는 한 스트림.
- 병합 순서 의존 있으면 순차(예: 같은 `editor.tsx`를 만지는 두 스트림).

## 3. zod 검증 — 폼은 `null`을 보낸다

- **폼 미선택 관계 필드·빈 날짜는 `null`로 전달된다(`undefined` 아님).** `z.string().optional()`은 `undefined`만 받고 `null`에서 `ZodError("expected string, received null")`. → optional id/date는 **`.nullish()`**(null·undefined·"" 허용)로 정규화.
- 실제 사례: `optionalId`/`optionalDate`가 `.optional()`이라 **모든 create/update가 저장 실패**("DB 문제"로 오인). `.nullish()`로 일괄 복구. (`src/lib/validators.ts`)

## 4. Base UI 컴포넌트

- **`<Select.Value>`는 render 함수 없이는 선택된 원시 value(cuid/enum)를 노출한다.** 라벨을 보이려면 `children={(value) => label}` render 함수 필요. → 엔티티 select는 **`src/components/selects/option-select.tsx`의 `OptionSelect` + 공용 렌더러**를 쓴다(트리거 라벨·sentinel 처리 포함). 새 select도 이걸로.
- **`MenuGroupContext is missing`**: Base UI 메뉴 파트를 `<Menu.Group>`/`<Menu.RadioGroup>` 밖에서 쓰면 발생. 드롭다운 메뉴 구성 시 그룹 래핑 확인.
  - **실제 재발(2026-07-09)**: `UserMenu`(헤더 우측 프로필)의 `DropdownMenuLabel`(=`Menu.GroupLabel`)이 `DropdownMenuGroup` 밖에 있어, **아바타 클릭 순간** 이 오류로 드롭다운 전체가 크래시(메뉴가 아예 안 열림, 콘솔에만 throw). 특히 `GroupLabel`·`Separator` 를 그룹 밖에 두기 쉬우니 주의 → `DropdownMenuGroup` 으로 감싸면 해결. build/tsc/lint 로는 안 잡히고 **실제 클릭 시에만** 터진다.

## 5. `Card` 컴포넌트 여백 (spacing 버그 단골)

- `Card`는 기본으로 **`py-(--card-spacing)`(16px 세로 패딩) + `gap-(--card-spacing)`(자식 간 16px gap)** 을 갖는다.
- **이중 패딩**: `Card` 안 `CardContent`에 또 `py-*`를 주면 세로 패딩이 겹친다(예: 대시보드 상태 카드 32px). → CardContent 세로 패딩 제거(`py-0`)하고 Card 기본값에 맡긴다.
- **`divide-y` 리스트**: `Card`에 `divide-y`만 주면 기본 `gap-16px`가 divider와 충돌해 행 간격이 불균등. → **`gap-0` override** 로 행이 divider에 flush 되게.

## 6. 디자인 시스템

- DESIGN.md는 **Vercel near-white 라이트 테마**다(예전 프로젝트 CLAUDE.md의 "Linear 다크" 서술은 stale이라 이미 현행화함). 색은 하드코딩 말고 `globals.css` CSS 변수로. 상세는 [`design-system.md`](./design-system.md).

## 7. 서버 액션(RSC) 직렬화 — Tiptap `getJSON()` 은 순수 JSON 으로 클론해서 넘긴다

- **증상**: 위키 저장 시 서버에서 `Error: Cannot access toStringTag on the server. You cannot dot into a temporary client reference from a server component.` (스택은 `prisma.wikiPage.update` 의 content 직렬화 지점). `POST /wiki/... 500`, 클라이언트엔 "저장에 실패했습니다" 토스트.
- **원인**: `editor.getJSON()` 반환 객체를 **서버 액션 인자로 그대로** 넘기면, RSC 경계 직렬화가 노드 내부를 **'temporary client reference'** 로 취급한다(순수 plain object 가 아님). 서버에서 Prisma 가 그 값의 `Symbol.toStringTag` 를 읽으려다 throw.
- **해결**: 클라이언트에서 **`JSON.parse(JSON.stringify(editor.getJSON()))`** 로 순수 JSON 클론을 만들어 넘긴다(`editor.tsx` `save()`). 멘션 노드 등은 plain 데이터라 클론이 무손실.
- **주의**: 이 버그는 **B9 위키 개편 때부터 잠복**(worktree 는 `next dev` 를 못 돌려 라이브 저장이 검증 안 됨 → build/tsc/lint 만으론 안 잡힘). 서버 액션에 리치 에디터 JSON·서드파티 객체를 넘길 땐 항상 plain 클론.
- 곁다리: 같은 위키 에디터에서 `[tiptap warn]: Duplicate extension names ['link']` 는 **StarterKit v3 가 Link 를 기본 포함**해서 났다 → `StarterKit.configure({ link: false })` 로 끄고 커스텀 Link 만 등록(`extensions.ts`).

## 7b. 읽기전용 Tiptap 에 마크 적용 — 잠깐 `setEditable(true)` (B10 인라인 댓글)

- **맥락**: 위키 뷰(`WikiCommentsView`)는 `editable: false` 로 본문을 렌더하는데, 인라인 댓글 앵커(`commentMark`)는 **뷰 모드에서** 선택 범위에 씌워야 한다.
- **함정**: `editable: false` 상태에서 `editor.chain().setMark(...)` 는 커맨드 가드에 막혀 트랜잭션이 반영 안 될 수 있다.
- **해결**: 마크 적용 순간만 `editor.setEditable(true)` → `chain().setTextSelection({from,to}).setCommentThread(id).run()` → `getJSON()`(순수 클론, §7) → `editor.setEditable(false)`. 삭제(마크 strip)도 동일 패턴.
- **DOM↔PM 위치 매핑**: 플로팅 '댓글' 버튼은 `window.getSelection()` 의 DOM Range 를 `editor.view.posAtDOM(node, offset)` 로 PM 위치(from/to)로 변환해 계산한다. 선택이 본문(`editor.view.dom`) 밖이면 무시(try/catch 가드).
- **앵커 저장은 리비전 없이**: 댓글 마크만 바뀔 땐 일반 저장(`updateWikiContent`, 리비전·알림 생성) 대신 **`saveWikiCommentAnchors`(content 만 update)** 를 쓴다 — 코멘트 부착이 위키 버전 히스토리를 오염시키지 않게. last-write-wins라 동시 편집과 경합 가능(뷰 모드 부착이라 실제론 드묾).

## 7c. 서버 컴포넌트 표에 onClick 을 직접 못 준다 (목록 행별 수정)

- **맥락**: 목록 표(`tables/*`)는 서버 컴포넌트. 행 전체가 `TableRowLink`(client)라, 행 안의 수정 버튼 클릭이 행 이동으로 전파되지 않게 `stopPropagation` 이 필요하다.
- **함정**: 서버 컴포넌트에서 `<TableCell onClick={…}>` 처럼 이벤트 핸들러를 넘기면 런타임 에러(`Event handlers cannot be passed to Client Component props`).
- **해결**: onClick 을 다루는 얇은 **client 래퍼**(`tables/row-action-cell.tsx` `RowActionCell`)로 분리해 그 안에 편집 다이얼로그를 넣는다. 다이얼로그(client)에 데이터 props + `trigger`(React element)만 넘기는 건 RSC 경계에서 허용된다(이벤트 핸들러만 금지).

## 8. 스키마 특이사항 (현행)

- 이슈 key는 **팀 단위 연속 시퀀스**(`Team.seq` 원자 증가, `src/server/keys.ts` `nextTeamNumber`, 트랜잭션 필수). 표시는 `formatIssueKey(teamKey, number)`.
- Task는 생성 시 Epic의 `teamId`를 상속·고정(에픽 이동에도 key 불변). 팀/번호는 update에서 strip.
- 위키: `WikiPage`(parent 중첩) + `WikiFolder`(별개 그룹핑 타입), `WikiPageTaskLink`(티켓↔위키), `WikiRevision`(버전), `WikiFavorite`(별표), `WikiCommentThread`+`WikiComment`(B10 인라인 댓글, 앵커는 문서 content 의 `commentMark`), `WikiDraft`(편집 임시저장, 유저×페이지 1건·2주 만료). `Activity`(범용 변경 로그, entityType/entityId/meta).
- **위키 soft-delete**: `WikiPage.deletedAt`(휴지통). 삭제는 서브트리 `deletedAt` 세팅(하드 아님), 복원/영구삭제는 `/wiki/trash`. **새 위키 페이지 조회를 추가하면 `where: { deletedAt: null }` 필터를 반드시 넣을 것**(안 넣으면 휴지통 문서가 목록/검색에 샌다). 영구삭제(`purgeWikiPage`)만 `prisma.wikiPage.delete`(cascade). C7 전역 검색 `globalSearch`도 이 필터 적용됨.

## 9. 서브에이전트 산출물에 NUL/비-UTF8 바이트 (병렬 worktree 검증 시)

- **증상**: 서브에이전트가 편집한 `.ts` 파일을 `git diff --stat`이 `Bin 7002 -> 9361 bytes` + `0 insertions/deletions`로 표시(텍스트인데 **바이너리로 인식**). tsc/eslint는 통과해서 안 걸러진다.
- **원인(실제 사례, A2)**: 에이전트가 sentinel 문자열로 **NUL 문자(`"\x00"`)** 를 코드에 박음(`const START = "\x00"`). NUL 1바이트만 있어도 git이 binary로 판정.
- **탐지**: `python3 -c "print(open(f,'rb').read().count(b'\x00'))"` 또는 `git diff --stat`에 `Bin`이 뜨는지. 병렬 스트림 병합 전 **변경/신규 파일 NUL 스캔을 루틴화**(`file <f>`가 `data`로 나오면 의심).
- **해결**: NUL을 안전한 문자열로 치환(예: `"__start__"` 등 실제 값과 충돌 안 하는 sentinel). 서브에이전트 프롬프트에 "정상 텍스트만 작성, NUL/비-UTF8 금지"를 명시.

## 10. 읽기전용 Tiptap 뷰는 `content` prop 변경에 반응하지 않는다

- **증상(2026-07-09)**: 위키 편집 cmd+Enter 저장 → 뷰로 전환하면 **본문이 옛 내용 그대로**, 브라우저 새로고침해야 반영됨.
- **원인**: Tiptap `useEditor({ content })` 는 **최초 마운트 때만** content 를 반영하고 이후 prop 변경엔 반응 안 한다. 저장 후 `router.refresh()` 로 서버가 새 본문을 내려줘도, 뷰 셸(`WikiCommentsView`)이 이미 마운트돼 있어 에디터가 옛 문서를 붙들고 있음. 수동 새로고침(전체 remount)해야만 새 content 로 재초기화.
- **해결**: `content` prop 이 바뀌면 에디터에 직접 반영하는 effect 추가 —
  `useEffect(() => { if (!editor) return; if (JSON.stringify(content) === JSON.stringify(editor.getJSON())) return; editor.commands.setContent(content, { emitUpdate: false }); }, [editor, content])`. deps 가 `content` 참조 변경일 때만 도므로 로컬 편집(댓글 마크 등) 중에는 안 돈다.
- **주의**: build/tsc/lint 로는 안 잡힘 — **실제 저장→뷰 전환** 을 브라우저에서 확인해야 재현/검증됨.

## 11. 스크롤 컨테이너 자기 하단 패딩은 overflow 끝에서 무시될 수 있다

- **증상(2026-07-09)**: 위키 본문이 길어지면 하단 "연결된 티켓"이 화면 바닥에 딱 붙음(짧을 땐 여백 큼). 앱 셸 `main` 에 `pb-12` 가 있는데도 안 먹힘.
- **원인**: `overflow-y-auto` 컨테이너의 **자기 `padding-bottom`** 은 스크롤 가능 영역(scrollable overflow) 끝에서 브라우저가 무시할 수 있다(특히 WebKit). 화면에 다 들어오는 짧은 콘텐츠에선 남는 공간이 여백처럼 보여 문제를 못 느끼다가, overflow 나면 드러난다.
- **해결**: 하단 여백을 **스크롤 높이에 포함되는 자식 블록**에 준다 — 스크롤 컨테이너 자신이 아니라 그 안 콘텐츠 래퍼에 `pb-*`(예: `wiki/[id]/page.tsx` 루트 `pb-16`). 자식의 패딩은 자기 박스 높이에 포함돼 `scrollHeight` 에 반영되므로 항상 렌더된다.

## 12. 목록→상세 우측 슬라이드 = intercepting + parallel routes (전체 상세 재사용)

- **패턴(2026-07-09)**: 목록에서 key 클릭 시 **기존 상세 페이지를 그대로** 우측 슬라이드로 띄우고, ↗ 버튼은 새 탭 전체 페이지로 여는 구조. Next 16 intercepting+parallel routes 로 구현.
- **파일 구조(세그먼트별, tasks/epics/projects 동일)**: `{seg}/layout.tsx`(children + `detail` 슬롯 렌더) · `{seg}/@detail/default.tsx`(→ `null`) · `{seg}/@detail/(.)[id]/page.tsx`(전체 상세 `[id]/page` 를 import 해 `DetailSheet`(client Sheet)로 감쌈). `@detail` 슬롯을 **각 목록 세그먼트 안**에 두어 인터셉트를 그 목록에서만 발생시킴(보드·대시보드·위키 등 다른 곳의 상세 링크는 기존대로 전체 페이지 이동).
- **핵심 동작**: soft-nav(목록 내 key 클릭 = `<Link>`/`router.push`)만 인터셉트 → children 슬롯은 목록 유지, `@detail` 이 시트 렌더(URL 은 `/x/[id]` 로 마스킹). hard-load/새 탭(`target=_blank`)은 인터셉트 안 되고 children 의 `[id]/page` 전체가 렌더. `default.tsx` 는 미매칭 슬롯용(→ null).
- **전체 재사용 방법**: 상세 body 를 따로 추출하지 않고 **`[id]/page` 의 default export(async server component)를 그대로 `<TaskDetail params={params} />` 로 렌더**. React 19 타입에서 async 컴포넌트를 JSX 자식으로 써도 tsc 통과(`@ts-expect-error` 불필요).
- **셀 인라인 편집과의 충돌**: 목록 행이 예전엔 `TableRowLink`(행 전체 클릭 이동)였는데, 셀 안에 편집 컨트롤(select/input)을 넣으면 클릭이 행 이동으로 샌다 → **행 전체 링크를 제거**하고 key 셀만 트리거(`OpenDetailKey`), 나머지 셀은 인라인 편집. (프로젝트는 key 가 없어 후행 아이콘 셀 `OpenDetailIcon` 로 연다.)
- **검증 주의**: 인터셉트 슬라이드는 build 로는 라우트 등록만 확인됨(`/x/(.)[id]` 가 route 목록에 뜸). **실제 열림/닫힘·↗ 새 탭은 브라우저 soft-nav 로 확인**해야 함(직접 URL 진입은 hard-load 라 전체 페이지가 뜸 — 인터셉트 아님).

## 13. Next 16 데이터 캐시(unstable_cache) + `revalidateTag` 시그니처 (D3 캐싱)

- **배경(2026-07-09)**: 공유(비유저 종속) 목록/옵션/트리 쿼리를 `unstable_cache` 로 감싸 요청 간 DB 부하를 줄였다(`src/lib/cache.ts` 태그 + `queries.ts` 래핑). 페이지는 `requireUser`(쿠키)로 어차피 동적(force-dynamic)이라 라우트 캐시는 그대로 두고 **데이터 레이어만** 캐시 — 순수 additive.
- **`use cache` 아님**: Next 16 은 `use cache` 디렉티브를 권장하지만 `cacheComponents` 플래그가 필요하다(이 프로젝트는 미설정). 플래그를 켜면 force-dynamic·Suspense 경계 전면 재작업이라 과함 → **`unstable_cache`(구 모델)** 가 저위험 선택.
- **함정: `revalidateTag` 두 번째 인자 필수.** Next 16 에서 `revalidateTag(tag)` 단일 인자는 **deprecated**(TS 에러 `Expected 2 arguments, but got 1`). 기본 권장값 `"max"` 는 **stale-while-revalidate**(옛 데이터 먼저 서빙)라, 사용자가 방금 편집한 내용을 다음 요청에서 바로 못 볼 수 있다 → 내부 툴엔 부적절. **`revalidateTag(tag, { expire: 0 })`** 로 즉시 만료시켜 `revalidatePath` 와 동일한 일관성을 준다. (`bumpTags` 헬퍼가 처리.)
- **캐시 대상 선정 원칙**: 유저별/검색/상세 쿼리는 캐시 금지(정합성 리스크·저가치). 캐시한 목록은 **교차 엔티티 표시 의존성**을 무효화에 반영해야 한다 — 예: 팀 key 변경 → 에픽/태스크 목록에도 반영되므로 team 액션이 `epics`/`tasks` 태그도 bump. 놓쳤을 때를 대비해 `unstable_cache` 에 시간 백스톱(`revalidate`)도 함께 둔다.
- **주의**: dev 서버에서도 `unstable_cache` 는 동작(라우트 캐시와 별개)하므로, 캐싱 관련 검증 시 태그 무효화가 실제로 도는지 확인.

## 14. 아이콘 전용 인터랙티브 요소엔 접근 가능한 이름 필수 (D9 a11y)

- **원칙**: 자식이 아이콘(lucide)만인 버튼/트리거는 `aria-label`(또는 `title`, `sr-only` 텍스트)로 스크린리더용 이름을 반드시 준다. 텍스트 라벨이 함께 있으면 불필요.
- **`Button` 프리미티브(ui/button.tsx)는 focus-visible ring 내장** — `Button` 사용처는 포커스 링을 따로 안 줘도 됨. 커스텀 `outline-none` 요소만 `focus-visible:ring*` 대체 표시를 확인.
- **실제 갭(2026-07-09 전수 점검)**: 앱 셸 모바일 메뉴(`layout.tsx`, `<Menu/>` 아이콘만)·위키 에디터 툴바 13개(`editor.tsx` `Btn` — 굵게/기울임/제목/목록/실행취소 등)가 이름 없이 남아 있었음 → `aria-label` 추가(툴바는 `title`+`aria-pressed`도). 나머지(⋯메뉴·닫기·색상칩·연결해제 등)는 이미 `aria-label`/`title` 보유.
- **calendar nav**: react-day-picker 기본 nav 버튼은 라이브러리가 aria-label 을 제공(Chevron 아이콘만 커스텀) → 별도 처리 불필요.
