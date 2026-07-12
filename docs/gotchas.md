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

- **패턴(2026-07-09)**: 목록에서 key 클릭 시 **기존 상세 페이지를 그대로** 우측 슬라이드로 띄우고, 새 창 열기 버튼은 새 탭 전체 페이지로 여는 구조. Next 16 intercepting+parallel routes 로 구현.
- **파일 구조(세그먼트별, tasks/epics/projects 동일)**: `{seg}/layout.tsx`(children + `detail` 슬롯 렌더) · `{seg}/@detail/default.tsx`(→ `null`) · `{seg}/@detail/(.)[id]/page.tsx`(전체 상세 `[id]/page` 를 import 해 `DetailSheet`(client Sheet)로 감쌈). `@detail` 슬롯을 **각 목록 세그먼트 안**에 두어 인터셉트를 그 목록에서만 발생시킴(보드·대시보드·위키 등 다른 곳의 상세 링크는 기존대로 전체 페이지 이동).
- **핵심 동작**: soft-nav(목록 내 key 클릭 = `<Link>`/`router.push`)만 인터셉트 → children 슬롯은 목록 유지, `@detail` 이 시트 렌더(URL 은 `/x/[id]` 로 마스킹). hard-load/새 탭(`target=_blank`)은 인터셉트 안 되고 children 의 `[id]/page` 전체가 렌더. `default.tsx` 는 미매칭 슬롯용(→ null).
- **전체 재사용 방법**: 상세 body 를 따로 추출하지 않고 **`[id]/page` 의 default export(async server component)를 그대로 `<TaskDetail params={params} />` 로 렌더**. React 19 타입에서 async 컴포넌트를 JSX 자식으로 써도 tsc 통과(`@ts-expect-error` 불필요).
- **셀 인라인 편집 + 행 전체 클릭 (2026-07-09 갱신)**: 목록 행 어디를 눌러도 시트가 열리되, 셀 안 편집 컨트롤(select/input/버튼/링크·새 창 열기)은 그대로 동작해야 한다 → **`RowOpenSheet`**(`src/components/ui/table-row-link.tsx`)가 행 `onClick` 에서 `e.target.closest(INTERACTIVE)`(a·button·input·textarea·select·`[role=combobox]`·`[data-slot=select-trigger]` 등)면 내비게이션을 스킵하는 **인터랙티브 가드**로 처리한다. 편집(`edit`) 모드 행만 `RowOpenSheet` 로 감싸고 하위목록(non-edit)은 일반 `TableRow`(인터셉트 슬롯이 없어 소프트 인터셉트 안 됨). 제목 셀은 `InlineTitle` 의 클릭-투-에딧(글자=편집, 우측 빈공간=상세 링크)로 별도 처리. 새 창 열기 버튼은 `<a target=_blank>` 라 가드에 걸려 새 탭으로 연다. (예전의 "행 링크 제거 후 key 셀만 트리거" 서술은 폐기 — 지금은 행 전체 클릭이 정상.)
- **함정: 인터셉트 라우트를 `router.prefetch` 하면 인터셉트가 깨진다.** `RowOpenSheet` 에 `onMouseEnter={() => router.prefetch(href)}` 를 넣었더니 dev 로그에 `⨯ Invalid interception route: /tasks/(.)(.)<id>` 가 쏟아지며 **키 링크·행 클릭 모두 시트 대신 전체 페이지로 폴백**했다(인터셉트 모듈이 깨짐). `<Link>` 의 자동 prefetch 는 이 문제가 없지만 **수동 `router.prefetch(<인터셉트 대상 경로>)` 는 금지**. 이미 깨진 상태면 `rm -rf .next` + dev 재시작으로 stale 모듈 정리.
- **깜빡임 방지(스트리밍)**: `@detail` 슬롯엔 자체 `loading.tsx` 가 없어, force-dynamic 상세가 서버 렌더되는 동안 상위 `(app)/loading.tsx` 가 **전체 화면(목록 포함)**을 스켈레톤으로 덮어 깜빡였다 → 인터셉트 `page.tsx` 에서 시트(client)는 즉시 렌더하고 **본문만 `<Suspense fallback={<DetailSkeleton/>}>` 로 감싸** 스트리밍(`src/components/detail/detail-skeleton.tsx`). 목록 유지 + 시트만 슬라이드 + 내부만 스켈레톤→콘텐츠.
- **검증 주의**: 인터셉트 슬라이드는 build 로는 라우트 등록만 확인됨(`/x/(.)[id]` 가 route 목록에 뜸). **실제 열림/닫힘·새 창 열기 새 탭은 브라우저 soft-nav 로 확인**해야 함(직접 URL 진입은 hard-load 라 전체 페이지가 뜸 — 인터셉트 아님). claude-in-chrome 자동화 툴은 이 소프트 내비를 구동하지 못해 시트를 못 띄우는 경우가 있으니 육안 확인 권장.

## 13. Next 16 데이터 캐시(unstable_cache) + `revalidateTag` 시그니처 (D3 캐싱)

- **배경(2026-07-09)**: 공유(비유저 종속) 목록/옵션/트리 쿼리를 `unstable_cache` 로 감싸 요청 간 DB 부하를 줄였다(`src/lib/cache.ts` 태그 + `queries.ts` 래핑). 페이지는 `requireUser`(쿠키)로 어차피 동적(force-dynamic)이라 라우트 캐시는 그대로 두고 **데이터 레이어만** 캐시 — 순수 additive.
- **`use cache` 아님**: Next 16 은 `use cache` 디렉티브를 권장하지만 `cacheComponents` 플래그가 필요하다(이 프로젝트는 미설정). 플래그를 켜면 force-dynamic·Suspense 경계 전면 재작업이라 과함 → **`unstable_cache`(구 모델)** 가 저위험 선택.
- **함정: mutation 직후 반영 안 되는 off-by-one staleness → `updateTag` 로 해결(2026-07-12).** 처음엔 `revalidateTag(tag, { expire: 0 })` 로 무효화했는데, 이러면 **"한 번 변경 후 다음 변경/요청이 와야 이전 변경이 반영되는"** 증상이 팀·위키·태스크 등 캐시 쿼리 전반에서 났다. 원인: `revalidateTag` 는 `{ expire: 0 }` 을 줘도 `unstable_cache` 데이터 엔트리를 **stale-while-revalidate**(옛 값 1회 서빙 + 백그라운드 갱신)로 처리 → mutation 액션이 끝나고 `router.refresh()` 가 옛 데이터를 받는다. Next 16 문서(`node_modules/next/dist/docs/.../revalidateTag.md`·`updateTag.md`)는 이 **read-your-own-writes** 케이스에 Server Action 전용 **`updateTag(tag)`** 를 명시 권장한다 — 태그를 즉시 하드 만료시켜 다음 요청이 fresh 를 **기다린다**(blocking miss). 그래서 `bumpTags` 를 `updateTag` 로 교체(`src/lib/cache.ts`). `updateTag` 는 Server Action 안에서만 호출 가능한데 `bumpTags` 호출부는 전부 `"use server"` 액션이라 안전(Route Handler 에서 쓰면 throw — 그럴 땐 `revalidateTag(tag, "max")`). 참고로 `revalidateTag(tag)` 단일 인자는 deprecated(TS 에러)라 쓰지 않는다.
- **캐시 대상 선정 원칙**: 유저별/검색/상세 쿼리는 캐시 금지(정합성 리스크·저가치). 캐시한 목록은 **교차 엔티티 표시 의존성**을 무효화에 반영해야 한다 — 예: 팀 key 변경 → 에픽/태스크 목록에도 반영되므로 team 액션이 `epics`/`tasks` 태그도 bump. 놓쳤을 때를 대비해 `unstable_cache` 에 시간 백스톱(`revalidate`)도 함께 둔다.
- **주의**: dev 서버에서도 `unstable_cache` 는 동작(라우트 캐시와 별개)하므로, 캐싱 관련 검증 시 태그 무효화가 실제로 도는지 확인.

## 14. 아이콘 전용 인터랙티브 요소엔 접근 가능한 이름 필수 (D9 a11y)

- **원칙**: 자식이 아이콘(lucide)만인 버튼/트리거는 `aria-label`(또는 `title`, `sr-only` 텍스트)로 스크린리더용 이름을 반드시 준다. 텍스트 라벨이 함께 있으면 불필요.
- **`Button` 프리미티브(ui/button.tsx)는 focus-visible ring 내장** — `Button` 사용처는 포커스 링을 따로 안 줘도 됨. 커스텀 `outline-none` 요소만 `focus-visible:ring*` 대체 표시를 확인.
- **실제 갭(2026-07-09 전수 점검)**: 앱 셸 모바일 메뉴(`layout.tsx`, `<Menu/>` 아이콘만)·위키 에디터 툴바 13개(`editor.tsx` `Btn` — 굵게/기울임/제목/목록/실행취소 등)가 이름 없이 남아 있었음 → `aria-label` 추가(툴바는 `title`+`aria-pressed`도). 나머지(⋯메뉴·닫기·색상칩·연결해제 등)는 이미 `aria-label`/`title` 보유.
- **calendar nav**: react-day-picker 기본 nav 버튼은 라이브러리가 aria-label 을 제공(Chevron 아이콘만 커스텀) → 별도 처리 불필요.

## 15. 반응형 — 마진노트/고정폭 레이아웃은 모바일에서 붕괴 (특히 위키)

- **위키 인라인 댓글(구글독스식)**: 댓글이 있으면 본문에 `padding-right: 296px` 를 강제하고 카드를 `absolute right-0 w-72` 로 배치한다(§ wiki-comments-view). 데스크톱 마진노트엔 맞지만 **모바일(~320px)에선 본문이 ~24px 로 뭉개진다.** → `useSyncExternalStore` 로 `(min-width:768px)` 를 감지해 **md+ 만 거터/절대배치, 모바일은 전체폭 본문 + 댓글을 본문 아래 일반 흐름으로 스택**.
- **위키 좌측 사이드바(`hidden md:block`)**: 모바일에서 페이지 트리가 통째로 사라져 문서 탐색 불가였음 → 모바일 전용 Sheet 드로어(`wiki-nav-sheet.tsx`)로 접근 제공(앱 셸 모바일 메뉴 패턴 재사용).
- **react-hooks 규칙이 아주 엄격**: 이 레포 eslint 는 `react-hooks/set-state-in-effect`(effect 에서 setState 금지) **뿐 아니라** `react-hooks/refs`(**render 중 `ref.current` 접근 금지**)도 켜져 있다. "경로 변경 시 시트 닫기" 같은 prop→state 동기화는 effect 도, ref 로 이전값 비교도 막힌다 → **이전 값을 `useState` 로 들고 render 중 조건부 `setState`**(React 공식 "adjusting state when a prop changes")로 해결. 뷰포트 등 외부 소스 구독은 `useSyncExternalStore` 가 lint-safe + 하이드레이션 안전.
- **고정폭 그리드 점검**: `grid-cols-[15rem_1fr]`·`grid grid-cols-2`(반응형 없음)는 좁은 폭(다이얼로그·모바일)에서 협소/붕괴 → `grid-cols-1 ... sm:grid-cols-*` 로 스택. 테이블은 ui/table 이 이미 `overflow-x-auto` 래핑, 보드는 `overflow-x-auto`, 다이얼로그는 `max-w-[calc(100%-2rem)] sm:max-w-*` 라 대체로 안전.

## 16. 위키 본문검색 — `WikiPage.searchText` denormalized 사본 (C7 확장)

- **배경(2026-07-09)**: 전역 검색(⌘K `globalSearch`)의 위키가 제목만 매칭했다(C7 알려진 한계). 본문은 Tiptap 리치 JSON(`content Json`)이라 SQL `contains` 로 바로 못 뒤진다 → **순수 텍스트 사본 `searchText String?`** 를 추가해 저장 시 `docToPlainText(content)` 로 채우고, `globalSearch` 가 `OR: [{ title }, { searchText }]` 로 조회한다. 제목 미매칭·본문 매칭이면 결과 `subtitle` 에 `searchExcerpt` 발췌를 표시.
- **쓰기 경로 3곳 동기화 필수**: 본문을 바꾸는 액션마다 `searchText` 도 갱신해야 스테일이 안 남는다 — `createWikiPage`(빈 `""`), `updateWikiContent`, `restoreWikiRevision`. **`renameWikiPage` 는 제목만 바꾸므로 본문 사본 갱신 불필요**(제목은 별도 매칭). 새 본문 변경 경로를 추가하면 여기도 채운다.
- **백필**: 기존 페이지는 `searchText=null` 이므로 `npx tsx prisma/backfill-wiki-search.ts`(미백필만 대상, idempotent) 1회 실행. **주의: 이 스크립트는 tsx 가 `@/` alias 를 못 풀어 `docToPlainText` 로직을 인라인 복제**한다 → `rich-content.ts` 의 `docToPlainText` 를 바꾸면 백필 스크립트도 함께 맞춘다.
- **인덱스 없음(의도)**: `contains`(ILIKE `%q%`)는 btree 로 못 타지만, 위키 규모가 작아(20인 팀) 순차 스캔으로 충분 → GIN pg_trgm 확장 미도입. 트래픽·문서 수 커지면 그때 FTS(tsvector) 로 승급.

## 17. 라우트 에러/로딩 바운더리 · 태스크 의존성 순환 방지

- **에러/로딩 바운더리 배치**: `(app)/error.tsx`(client, `error`+`reset` props)·`(app)/loading.tsx`(Skeleton)는 **(app) 그룹 하위 전 세그먼트가 상속**한다 — 개별 페이지마다 만들 필요 없음. 앱 셸 레이아웃은 유지되고 본문만 폴백/스켈레톤으로 교체. 특정 화면에 더 맞는 스켈레톤이 필요할 때만 그 세그먼트에 `loading.tsx` 추가.
  - **`global-error.tsx` 는 루트 레이아웃 자체가 throw 할 때만** 발동 → 레이아웃이 없으므로 **자체 `<html>/<body>` 를 렌더**해야 하고, 전역 CSS 로딩을 보장 못 해 **인라인 스타일**로만 최소 폴백을 짠다(라이트 테마 하드코딩). 일반 페이지 오류는 `(app)/error.tsx` 가 잡으므로 global-error 는 극단 상황 안전망.
  - **검증 주의**: 에러 바운더리는 **런타임 throw 시에만** 보이므로 build/tsc/lint 로는 발동 확인 불가 — 실제 오류를 유발(또는 임시 `throw`)해 폴백/`reset()` 재시도를 브라우저에서 확인. `global-error` 는 **프로덕션 빌드에서만** 활성(dev 는 에러 오버레이가 뜸).
- **태스크 의존성 방향·순환**: `TaskDependency` 는 `blocker→blocked` **방향 엣지**(blocked 가 blocker 에 의존). Task 릴레이션 이름이 헷갈리기 쉽다 — `Task.blocking`=내가 blocker 인 엣지(**내가 막는** 태스크들, `dep.blocked` 로 상대 조회), `Task.blockedBy`=내가 blocked 인 엣지(**나를 막는** 태스크들, `dep.blocker` 로 상대 조회).
  - **순환은 DB 제약으로 못 막는다** → 엣지 추가 전 **전체 엣지를 로드해 `lib/task-deps.wouldCreateCycle`**(dependsOn 방향 도달성 검사)로 판정하고 거부(자기참조 포함). 그래프가 작아 전량 로드가 저렴. 이 순수 헬퍼는 유닛 테스트로 커버(`task-deps.test.ts`).
  - **UI 인자 순서**: `task-dependencies.tsx` 의 '차단됨'(blockers) 추가는 현재 태스크가 blocked → `addTaskDependency(pickedId, taskId)`, '차단함'(blocking) 추가는 현재가 blocker → `addTaskDependency(taskId, pickedId)`. 순서를 바꾸면 방향이 뒤집힌다.

## 18. 위키 리치 렌더링(표·코드 강조·mermaid)

- **확장은 한 곳(`wikiExtensions()`)에서만** 추가한다 → 에디터(`editor.tsx`)와 읽기전용 뷰(`wiki-view.tsx`·`wiki-comments-view.tsx`) 가 같은 배열을 쓰므로 편집·뷰가 자동으로 동일 스키마. 표(`TableKit`)·구문강조 코드블록(`CodeBlockLowlight`+lowlight)·mermaid(`MermaidBlock`)를 여기 한 줄씩만 등록.
- **StarterKit 기본 CodeBlock 을 끄고**(`codeBlock: false`) `CodeBlockLowlight` 로 대체한다(중복 확장 경고 방지, Link 를 끄는 것과 동일 패턴, [gotchas §7]). 강조 색은 `globals.css` 의 `.tiptap pre code .hljs-*` 라이트 팔레트.
- **mermaid 는 지연 로드(atom NodeView)**: `mermaid-block.tsx` 가 소스를 `attrs.code` 문자열로 저장하고, NodeView 의 effect 에서 `await import("mermaid")` 로 **동적 import**(번들 크지만 mermaid 블록 있는 페이지에서만 로드) 후 `mermaid.render(uniqueId, code)` SVG 를 주입한다. **렌더마다 고유 id 필수**(mermaid 가 그 id 로 임시 노드를 body 에 붙였다 지움 — 재사용 시 충돌). `securityLevel: "strict"`(다이어그램 내 스크립트/HTML 차단).
  - **setState 는 effect 본문 금지**([gotchas §15] `react-hooks/set-state-in-effect`): 빈 코드 처리·에러 표시 setState 를 모두 **async 콜백 안**에서 호출. 취소 플래그(`cancelled`)로 언마운트 후 setState 방지.
  - editor.isEditable 로 편집(코드 textarea 토글 + 실시간 미리보기) vs 뷰(다이어그램만) 분기. 읽기전용 뷰는 editable=false 라 자동으로 다이어그램만.
- **검색(searchText, §16) 커버리지**: `docToPlainText` 는 node.content 를 재귀하므로 **표 셀·코드블록 텍스트는 검색됨**. **mermaid 소스는 atom(attrs.code)라 검색 안 됨**(다이어그램은 프로즈 아님 — 의도).
- **검증 주의**: build/tsc/lint 로는 컴파일·번들만 확인됨. mermaid 실렌더·표 리사이즈·강조는 **브라우저에서** 확인해야 한다(로그인 게이트 — SSO 세션 필요). mermaid 문법 오류는 NodeView 가 `.wiki-mermaid-error` 로 표시.

## 19. 상세 시트 레이아웃은 컨테이너 쿼리로 (뷰포트 `lg:` 아님) · 스크롤바 시프트 (2026-07-09 UX)

- **뷰포트 브레이크포인트 함정**: 상세 페이지(`{seg}/[id]/page.tsx`)는 전체 페이지(넓음)와 우측 시트(≈720px) **양쪽에서 재사용**된다. 그리드에 `lg:grid-cols-3`(뷰포트 기준)를 쓰면 뷰포트가 넓을 때 **좁은 시트 안에서도 3열이 강제**돼 텍스트가 겹친다 → **컨테이너 쿼리**로 전환: 루트를 `@container/detail`, 그리드를 `@3xl/detail:grid-cols-3`(자식은 `@3xl/detail:col-span-*`). 시트 컨테이너(≈720px < 48rem)는 1열, 전체 페이지(≥768px)는 3열. Tailwind v4 는 컨테이너 쿼리 내장(`@container/name` + `@3xl/name:`). tasks·epics·projects 3곳 동일.
- **모달 열 때 좌우 밀림(스크롤바 보정)**: 이 앱의 유일한 스크롤바는 `(app)/layout.tsx` 의 `<main overflow-y-auto>` 에 있다(body 는 `overflow-hidden`). 시트(Base UI Dialog) 열 때 스크롤 락으로 `<main>` 스크롤바가 사라지면 콘텐츠가 폭만큼 넓어져 좌우로 튄다 → `<main>` 에 **`[scrollbar-gutter:stable]`** 로 스크롤바 폭을 항상 예약.

## 20. 인라인 숫자(MD) 입력 · 추정 단위 SP→MD 일원화 (2026-07-09)

- **추정 단위 = MD 단일**: `Task.storyPoints`(Int) **컬럼 DROP**(마이그레이션 `..._drop_task_story_points`). 추정은 `estimatedMd`/`actualMd`(Float, 소수) 뿐. 목록 표의 옛 "SP" 열은 `estimatedMd` 로, 에픽 롤업(`getEpics`)·스프린트 합(`getSprints` raw 집계)도 MD 기준. **`storyPoints` 를 다시 참조하면 tsc/런타임 에러**(스키마에 없음).
- **인라인 편집 입력은 `type="text" inputMode="decimal"`**: `type="number"` 스피너(±카운트) 대신 직접 타이핑. `optionalMd` 검증은 `z.coerce.number().min(0)`(`.int()` 없음)이라 소수 허용. `InlineNumber`(`detail/inline-fields.tsx`)는 이제 MD 전용(storyPoints 제거).
- **정렬 함정**: 우측정렬 인풋을 셀에 넣으면 헤더와 값 우측선이 인풋 패딩만큼 어긋나고, 고정폭이면 빈 박스가 좌측으로 뻗어 커 보인다 → **`[field-sizing:content]`(박스가 글자 폭만큼) + 좌측 정렬**(타이핑 시 우측 확장) + `min-w-*`(빈 값 클릭영역). 헤더/셀도 좌측 정렬로 맞춘다. MD·담당자 열이 붙으면 담당자 셀에 `pl-*` 로 간격.
- **리뷰 상태 제거 여파**: `Status` enum 에서 `IN_REVIEW` 삭제(Postgres enum 은 값 제거 불가 → 타입 재생성 마이그레이션, 기존 행은 BACKLOG 이관). 새 상태 참조·라벨·보드 컬럼은 4개(BACKLOG/TODO/IN_PROGRESS/DONE)만.

## 21. 상세 시트(우측 슬라이드) 상호작용 — 팝업 z-index · 재사용 상세 폭 · 블러 · 타임라인 고정선 (2026-07-10)

- **팝오버/셀렉트/드롭다운이 시트 뒤로 숨는다**: `DetailSheet` 의 `SheetContent` 는 `z-[60]`(좌측 사이드바 위로 띄우려고). 그런데 팝업 프리미티브 positioner 는 `z-50` 이라 시트 안에서 열면 **시트 뒤에 깔려 클릭이 안 된다**(→ "시트 안에선 편집이 안 된다"로 보임). 해결: `ui/{popover,select,dropdown-menu,context-menu}` 의 Positioner z 를 **`z-[70]`**(시트보다 큼)로. 새 오버레이/시트 z 를 올릴 때 팝업 z 도 함께 검토.
- **다이얼로그(삭제 확인 등)도 시트 뒤로 숨었다(2026-07-12 보완)**: 위 §21 최초 수정 때 팝업(popover/select/dropdown/context)만 z-[70] 로 올리고 **`ui/dialog` 는 놓쳤다.** 그래서 상세 시트 안에서 삭제(휴지통) 버튼 → `ConfirmDelete`(=`ui/dialog`) 를 열면 다이얼로그 Overlay/Content(`z-50`)가 시트(`z-[60]`) 뒤에 깔려 "삭제" 버튼을 못 누른다. 해결: `ui/dialog` 의 Overlay·Content z 를 **`z-[65]`**(시트 `z-[60]` 위, 팝업 `z-[70]` 아래)로. 이 사다리(시트 60 < 다이얼로그 65 < 팝업 70)면 다이얼로그 안의 select/dropdown 도 다이얼로그 위에 정상적으로 뜬다.
- **우상단 삭제·새 창·닫기 버튼이 겹친다 → 삭제를 크롬으로 포털(2026-07-13)**: 시트 크롬(DetailSheet 의 새 창 버튼 `right-11`, 닫기 버튼 `right-3`)과 재사용 상세 본문의 삭제 버튼(타이틀 행)이 서로 다른 컴포넌트에서 같은 우상단에 놓여 겹쳤다. 본문 루트가 `@container/detail`(=`container-type` → **abs 컨테이닝 블록**)이라 본문 안 삭제 버튼을 크롬 줄에 직접 못 맞춘다. 해결: `DetailSheet` 가 크롬에 삭제 슬롯(`<span ref>`)을 두고 그 노드를 `InSheetContext` 로 내려, 상세 페이지의 `SheetDeleteButton`(client)이 `createPortal` 로 그 슬롯에 붙인다 → 삭제·새 창·닫기 세 버튼 한 줄 정렬. 상세 페이지는 서버 컴포넌트라 `useInSheet` 를 못 쓰므로 이 client 래퍼가 감지한다.
  - **함정**: 크롬을 `<div>` 로 감싸면 안 된다. `SheetContent` 의 `[&>div]:w-full`(아래 콘텐츠 폭 보정용)이 **그 크롬 div 까지 잡아** `w-full` 이 되어 내용(새 창 버튼)이 화면 밖으로 밀린다(닫기 버튼만 남아 보임). 크롬은 `<span>`/`<a>` 로 각각 절대배치(div 아님 → 셀렉터 미적용).
- **재사용 상세가 시트에서 우측으로 쏠린다**: 전체 상세 페이지(`tasks/[id]/page`)를 인터셉트 시트에서 그대로 재사용하는데, 루트가 `mx-auto max-w-5xl`. `InSheetProvider` 는 DOM 래퍼가 없어 이 div 가 **`flex flex-col` 시트의 직접 자식**이 되고, `mx-auto`(좌우 auto 마진)가 flex 자식의 stretch 를 막아 **콘텐츠 폭이 내용만큼 줄고 한쪽으로 쏠린다**. 해결: `SheetContent` 에 `[&>div]:mx-0 [&>div]:w-full [&>div]:max-w-none` 로 자식을 폭 전체로 펴기.
- **배경 블러 제거**: 시트·다이얼로그 오버레이의 `supports-backdrop-filter:backdrop-blur-xs` 를 뺀다(`ui/sheet`·`ui/dialog`). 딤(`bg-black/10`)만 유지.
- **시트 안 다른 티켓 링크는 새 탭**: 시트 안에서 `/tasks/[id]` 로 소프트 내비하면 인터셉트가 다시 걸려 시트를 덮어쓴다 → `useInSheet()` 로 감지해 `target="_blank"`(하드 로드 = 전체 페이지). `task-dependencies` 의 선행/후속 링크에 적용.
- **타임라인 이름 열 ↔ 그래프 구분선**: 절대배치 오버레이+`onScroll` 동기화는 컴포지터 스크롤을 못 따라가 **흔들린다**. **sticky 거터의 `border-r`** 로 그리면(거터가 CSS sticky 라 프레임 지연 없음) 고정된다. 단 거터 사이 세로 틈(flex `gap`)이 있으면 선이 **끊기고** 그 틈으로 뒤 그리드(월 구분선)가 비친다 → 행 `gap-0` + 그룹 사이 **sticky 스페이서**로 이름 열을 세로 연속화. 거터 z 를 월 구분선 위로(z-30, 헤더 마스크 z-40).

## 22. 목록 기본 정렬엔 고유 tiebreaker(id) 필수 (2026-07-10)

- `getTasks`/`getBoardTasks` 처럼 **비고유 키로 정렬**(`[status, priority, createdAt]` 등)하면, 그 키들이 동일한 행(예: seed 로 같은 `createdAt`)의 순서가 **미정**이라 DB 가 힙 순서로 반환한다. 이 상태에서 아무 필드나 **UPDATE(예: MD 인라인 편집)** 하면 그 행의 힙 위치가 바뀌며 **동점 그룹 순서가 흔들린다**(정렬 키에 안 쓰인 MD 를 바꿔도 순서가 바뀌는 것처럼 보임). 해결: `orderBy` 맨 끝에 **`{ id: "asc" }`**(전역 고유) tiebreaker 를 추가해 결정적 순서 보장.

## 23. 상세 시트가 안 열리고 500 — Next 16 dev 의 인터셉팅 라우트 마커 누적 버그 (2026-07-12, 07-13 정정)

- **증상**: 프로젝트/에픽/태스크 목록에서 항목을 클릭해 우측 상세 시트(인터셉트)를 열면 **500** 이 나고 시트 대신 전체 페이지로 폴백된다. 서버 방금 켰을 땐 되다가, 파일 편집(HMR) 후 **다시 깨진다**("또 발생"). dev 콘솔: `⨯ Error: Invalid interception route: /projects/(.)(.)<id>. Must be in the format ...`.
- **원인**: 폴더 구조(`<seg>/@detail/(.)[id]`)·코드는 정상. **Next 16 Turbopack dev** 가 HMR/재컴파일 후 인터셉션 경로를 만들 때 `(.)` 마커를 **이중(`(.)(.)`)** 으로 붙인다. Next 의 `extractInterceptionRouteInformation`(`shared/lib/router/utils/interception-routes.js`) 이 `path.split('(.)', 2)` 하는데, 연속된 `(.)(.)` 탓에 두 번째 조각이 빈 문자열 → `interceptedRoute` falsy → throw. **주의(정정): webpack dev 도 HMR 을 충분히 반복하면 동일하게 재현된다**(마커가 `(.)(.)` → `(.)(.)(.)…` 로 누적, 관측상 11개까지). webpack 이 더 오래 버틸 뿐 면역이 아니며 **Next 16 dev(HMR) 공통 버그**(번들러 무관)다.
- **완화**: (1) `package.json` `dev` 를 `next dev --webpack` 으로(Turbopack 보다 덜 자주 깨짐). (2) **깨지면 dev 서버 재시작** → 마커 상태 초기화로 즉시 복구(진짜 해법은 Next 패치 대기). (3) 시트/인터셉트 UI 검증은 **fresh dev 또는 프로덕션 빌드**에서 HMR 을 많이 돌리기 전에 한다. build/tsc/lint 로는 안 잡히니 **브라우저 실확인** 필수.
- **프로덕션은 무해**: `next build` 는 라우트를 1회 컴파일하고 HMR 이 없어 doubling 이 안 생긴다(빌드 산출물에서 `(.)[id]` 단일 마커 확인). 배포엔 영향 없음.
