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

## 13. `unstable_cache` 는 멀티 replica 에서 pod-local → 제거함 (D3 캐싱 롤백, 2026-07-13)

**결론 먼저**: 공유 목록/옵션/트리 쿼리를 캐시하지 않는다. `queries.ts` 14개는 이제 매 렌더 **DB 직접 조회**(plain 함수). `src/lib/cache.ts`·`bumpTags`·`CACHE_TAGS` 는 삭제됨. 아래는 왜 도입했다가 걷어냈는지의 전말 — **재도입 금지 근거**.

- **도입(2026-07-09, D3)**: 공유(비유저 종속) 쿼리를 `unstable_cache` 로 감싸 요청 간 DB 부하 절감. `cacheComponents` 플래그가 필요한 `use cache` 대신 구 모델 `unstable_cache` 를 저위험으로 택함.
- **1차 함정 → `updateTag`(2026-07-12)**: `revalidateTag(tag, { expire: 0 })` 는 `unstable_cache` 를 **stale-while-revalidate** 로 처리해 mutation 직후 `router.refresh()` 가 옛 값을 받는 off-by-one 이 났다. Server Action 전용 `updateTag(tag)`(즉시 하드 만료, blocking miss)로 교체해 **같은 인스턴스 내** read-your-own-writes 는 고쳤다.
- **2차 함정(근본) → 캐시 제거(2026-07-13)**: `updateTag` 로도 **"위키 저장 후 좌측 사이드바 제목이 간헐적으로 안 바뀌는"** 버그가 prod 에서만 남았다. 원인은 **멀티 인스턴스 캐시 비정합**: prod 는 `replicas: 2` 인데 `next.config` 에 공유 `cacheHandler` 가 없어 `unstable_cache` 가 **pod 별 인메모리/파일 캐시**다. mutation 은 요청을 처리한 pod 만 `updateTag` 로 무효화하고, 이어지는 `router.refresh()`(별도 HTTP 요청)가 로드밸런서에 의해 **다른 pod 로 가면 stale**(~50%, 최대 `revalidate` 백스톱까지). dev·단일 인스턴스에선 절대 재현 안 됨.
  - **실측 증명**: 같은 DB 에 각자 캐시를 가진 프로덕션 인스턴스 2개를 띄우고 → B 사이드바 워밍 → A 에서 제목 변경 저장 → B 는 옛 제목 유지. (재현 레시피는 이 커밋 세션 참조.)
- **왜 "캐시 제거"를 택했나**: 대안은 (a) Redis 등 공유 `cacheHandler`, (b) `replicas: 1`, (c) sticky sessions. 20인 내부 툴에선 캐시 이득이 미미하고 DB 부하 무시가능 → **HA(2 replica) 유지 + 전 쿼리 정합성 확보 + 인프라 무추가**인 캐시 제거가 최선. `revalidatePath`/`router.refresh()` + force-dynamic + 클라이언트 라우터 캐시 `staleTime` 0 이면 read-your-own-writes·교차목록 반영 모두 보장된다(캐시가 없으니 애초에 stale 될 것이 없음).
- **재도입 금지**: 멀티 replica 인 채로 `unstable_cache`(또는 `use cache`)를 다시 쓰려면 **반드시 공유 `cacheHandler`(Redis 등)** 를 먼저 설정한다. 안 그러면 이 버그가 재발한다.
- **예외 — `lib/server-cache.ts`(2026-07-18, TTL 인메모리 캐시)**: 위 금지와 별개로, **정합성이 TTL 로만 보장돼도 되는 조회 전용 경로**(⌘K 전역 검색 15s·멘션 자동완성 30s)에는 자체 TTL 캐시를 쓴다. pod-local 이라 `cacheDelete`/`cacheClear` 는 같은 pod 에서만 유효한 best-effort — **무효화에 정합성을 의존하는 용도(목록/트리/옵션 등 read-your-own-writes 필요 경로)에 쓰면 §13 버그가 그대로 재발**하니 금지. 새 적용처를 늘릴 땐 "mutation 직후 이 화면이 옛 값을 보여도 되는가?"를 먼저 물을 것.

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

## 24. 다이얼로그 폼 리셋은 필드 state 를 popup 하위에 둬야 한다 (Base UI, 2026-07-15)

- **증상**: 만들기 다이얼로그에서 입력→저장(닫힘)→다시 열면 **이전 입력이 그대로 남는다**(만들기인데 빈 폼이 아님). 수정 후 취소→재열기도 편집중 값이 남음.
- **원인**: 필드 `useState` 초기화는 **마운트 1회만** 실행된다. 폼 필드 state 를 `XDialog`(open 을 소유, Trigger+Dialog 를 감쌈) **최상위**에 두면, 다이얼로그가 닫혀도 그 컴포넌트는 계속 마운트돼 있어 state 가 안 사라진다.
- **핵심**: Base UI `Dialog.Portal` 은 `keepMounted=false`(기본)라 **닫히면 popup 하위(DialogContent 자식)를 언마운트**한다(`shouldRender = mounted || keepMounted`). 따라서 **필드 state 를 `DialogContent` 하위의 자식 폼 컴포넌트로 내리면** 닫힐 때 언마운트되고 다시 열 때 초기값으로 새로 마운트 → 폼이 항상 리셋된다(닫힘 애니메이션 동안엔 값 유지 후 언마운트 → 깜빡임 없음). 만들기=빈 폼, 수정=원본 값.
- 적용: `forms/{project,epic,task,sprint,team}-dialog.tsx` = 바깥 `XDialog`(open 소유) + 안쪽 `XForm`(필드 state, `onClose` 로 닫음).
- 곁들여: **생성 액션은 미지정 담당자에 `?? user.id` 폴백 금지**. `optionalId`(nullish) 스키마가 이미 null 로 정규화하므로 `data` 를 그대로 넘긴다. 태스크 `reporterId=user.id` 는 작성자라 예외(폼 필드 없음).

## 25. auto-layout 표에서 셀 폭은 `w-*` 헤더만으론 안 잡힌다 — 내용 `max-w-*` 필요 (2026-07-15)

- `ui/table` 은 `table-auto`(기본)라 `<th class="w-40">` 은 **힌트일 뿐**, 셀 내용의 max-content 가 더 넓으면 컬럼이 그만큼 커진다. 라벨 배지(줄바꿈/truncate 없음)를 여러 개 붙이면 레이블 컬럼이 가로로 **밀려 다른 컬럼을 찌그러뜨린다**("라벨 추가 시 UI 깨짐").
- 해결: 셀 **내용**을 고정폭 컨테이너로 감싼다(`<div class="max-w-40">…</div>` 또는 `flex max-w-40 flex-wrap`). td 는 auto 라 max-width 를 무시하지만, td 안의 블록 요소는 max-width 를 존중 → 내용이 그 폭에서 줄바꿈되고 td 가 거기에 맞춰 커지지 않는다. projects/epics/tasks 표 레이블 셀 공통.

## 26. 타임라인 가로 무한 스크롤 — 하루 폭 고정 + prepend scrollLeft 보정 (2026-07-15)

- 데이터 범위에 스크롤이 묶여 에픽이 없거나 범위 밖으로는 스크롤이 안 되던 문제. 표시 창(range)을 **state** 로 두고 스크롤이 가장자리(EDGE_PX)에 오면 `CHUNK_DAYS` 만큼 과거/미래로 확장한다.
- **하루 셀 폭은 상수(DAY_W)로 고정**해야 한다. 폭을 `TARGET/days` 로 계산하면 창을 넓힐 때마다 재스케일돼 스크롤 위치 보정 계산(`CHUNK*dayWidth`)이 어긋난다.
- **prepend(과거 확장) 시 삽입된 폭만큼 `scrollLeft += CHUNK*DAY_W` 를 `useLayoutEffect`(pre-paint)로 보정**해야 화면이 안 튄다. 재진입 방지 `pending` ref, 마운트 시 오늘을 거터 옆에 위치시키는 초기 scrollLeft 도 같은 effect 에서. 에픽 0건도 축·그리드를 렌더해 스크롤 가능.

## 27. 코드블록 편집 동작(NodeView·자동닫기·들여쓰기·언어·멘션차단) 위치 (2026-07-15)

- 코드블록은 `CodeBlockLowlight.extend(...)` 한 곳(`extensions.ts`)에서 확장한다. `addNodeView`(복사·언어 select = `code-block.tsx` React NodeView), `addProseMirrorPlugins`(자동 닫기 = `code-block-pairs.ts`), `addKeyboardShortcuts`(Enter 들여쓰기).
- **베이스 동작 보존 필수**: `addProseMirrorPlugins`/`addKeyboardShortcuts` 를 override 하면 부모가 **교체**된다 → 반드시 `...(this.parent?.() ?? [])` / `...this.parent?.()` 로 lowlight 하이라이트 플러그인·Tab 들여쓰기·triple-Enter 종료를 이어붙인다.
- `NodeViewContent as="code"` 는 타입 인자를 명시해야 한다(`<NodeViewContent<"code"> as="code" />`) — `as` 가 `NoInfer` 제네릭이라 추론이 기본값 `'div'` 로 고정돼 `"code"` 대입 에러가 난다.
- 언어 하이라이트는 lowlight `common` 세트에 kotlin·java·json·yaml·swift 가 이미 포함 → 등록 불필요, `node.attrs.language` 만 바꾸면 됨.
- 코드블록 안 `#`/`@` 멘션 차단은 Suggestion `allow` 콜백(`state.doc.resolve(range.from).parent.type.name !== "codeBlock"`). mermaid 코드 textarea 의 Enter 들여쓰기는 controlled 라 `updateAttributes` 후 caret 이 끝으로 튀므로 pendingCaret ref + 재렌더 후 복원 effect 필요.

## 28. MD(맨데이)는 `Float` — 합산 롤업은 반드시 반올림 (2026-07-15)

- `Task.estimatedMd`/`actualMd` 가 Prisma `Float?` 라 **합산하면 이진 부동소수점 노이즈**가 생긴다(`0.1+0.2=0.30000000000000004`). 단일 값 표시는 무해하나 **롤업 합(에픽/스프린트/프로젝트)** 이 표에 긴 소수로 노출된다.
- 해결: `queries.ts` 의 모든 롤업 출력(`sumMd`·`mdByEpic`·`getEpics`·`getSprints`·`getProject`)에 `roundMd = n => Math.round(n*1e6)/1e6`(6자리) 적용. 6자리면 실제 입력값(0.5·2.25 등)은 보존하고 1e-15 수준 오차만 사라진다. **저장값은 안 건드리고 표시용 계산만** 반올림.

## 29. 위키 표 편집 — 삭제 키맵·hover 추가버튼·리사이즈 폭 고정 (2026-07-15)

- **삭제**(`table-controls.ts` Extension): 표 아래 블록 맨 앞에서 `ArrowLeft` → 앞 형제가 표면 `setNodeSelection` 으로 표 선택 → `Backspace`/`Delete` 로 삭제. TableKit 내부는 안 건드리는 별도 키맵 확장.
- **hover 열/행 추가**(`editor.tsx` `TableHoverControls`): 커서가 표 안일 때 `nodeDOM(tablePos)` 로 표 사각형을 읽어 우측/하단 스트립을 **오버레이**(좌표만 읽고 표 내부 로직 미변경). `selectionUpdate`/`transaction`/`scroll`/`resize` 에 위치 갱신. 편집 컨테이너가 `position:relative` 여야 좌표 기준이 맞다.
- **리사이즈 폭 고정**: 리사이즈 가능한 표는 `TableView` 가 열 너비 합으로 `<table>` 의 **inline `width`/`min-width`** 를 세팅해 드래그 시 표가 통째로 커진다. CSS `.tiptap table { width:100% !important; min-width:0 !important }` 로 inline 을 무시해 컨테이너 폭에 고정 → `table-layout:fixed` 상 경계선만 이동, 인접 열이 폭을 나눈다(엄밀한 인접-only 재분배가 필요하면 커스텀 리사이즈 플러그인 필요 — 현재는 비례 재분배).
- **드래그로 다중 추가**(2026-07-17): hover 스트립의 `+` 는 `onPointerDown` 에서 window `pointermove` 를 걸어 드래그 거리 `STEP`(열 48·행 32px) 마다 `addColumnAfter`/`addRowAfter` 를 1회씩 호출. 이동 0(=단순 클릭)이면 `pointerup` 에서 1개만 추가. 같은 스트립에 삭제(−, `deleteColumn`/`deleteRow`) 버튼도 인라인 노출(팝오버 삭제와 병행).

## 30. Prisma client 가 checked-in 스키마와 어긋나면 관계없는 파일에서 tsc 에러 (2026-07-17)

- **증상**: 내가 안 건드린 `src/app/api/wiki/image/[id]/route.ts`·`wiki/upload/route.ts` 에서 `'data' does not exist in type WikiImageSelect` 같은 tsc 에러. 생성된 `@prisma/client` 타입엔 `s3Key` 가 있고 `data` 가 없는데, checked-in `schema.prisma` 의 `WikiImage` 는 `data Bytes`(인라인) + 라우트 코드도 `data` 사용 → **client 만 다른(형제 worktree 의 S3) 스키마로 생성돼 있던 잔재**.
- **해결**: `npx prisma generate` 로 checked-in `schema.prisma` 기준 재생성. (스키마 변경/브랜치 병합 후 client 재생성 규칙 [§ "병합 후 npx prisma generate"] 의 한 사례 — **`npm install <pkg>` 는 client 를 재생성하지 않는다**. 별개로 확인.)
- **오진 주의**: `<cmd> 2>&1 | tail -n` 은 **파이프 종료코드가 tail(0)** 이라 npm/tsc 실패를 exit 0 으로 오인한다. 실패 판정이 필요하면 `; echo EXIT=$?` 를 명령 뒤에 붙이거나 파이프를 걷어낸다.

## 31. 위키 사이드바 폴더 접힘 상태는 트리 최상단이 소유해야 유지된다 (2026-07-17)

- **증상**: 상위 폴더를 접었다 펴면 하위 폴더가 이전 상태와 무관하게 모두 열림으로 리셋.
- **원인**: `FolderItem`/`PageItem` 이 각자 `useState(true)`(열림 기본)로 접힘을 가졌는데, **부모 접힘 시 렌더 게이트(`hasChildren && open && <ul>`)가 자식 서브트리를 언마운트** → 재오픈 때 자식이 재마운트되며 `useState(true)` 로 초기화. (`router.refresh` 아님.)
- **해결**: 접힘을 **`PageTree`(트리 최상단, 항목 언마운트와 무관)** 소유의 `collapsedIds: Set` 으로 승격. "열림이 기본, 닫은 것만 기억" = `open = !collapsedIds.has(key)`. 폴더/페이지 id 충돌 방지로 `f:`/`p:` 네임스페이스. localStorage `wiki:collapsed` 영속(initializer 에서 `typeof window` 가드). 새 하위항목 생성 시 부모를 `expand(key)` 로 강제 펼쳐 즉시 노출.

## 32. 에디터 이벤트 가로채기는 DOM 리스너가 아니라 `editorProps` 핸들러로 (2026-07-18)

- **증상**: 브라우저 '이미지 복사'(클립보드에 HTML `<img>` + 이미지 파일이 함께 담김)를 위키에 붙여넣으면 이미지가 두 개 삽입됨 — 외부 핫링크본 + 업로드본.
- **원인**: 이미지 paste 를 `editor.view.dom.addEventListener("paste", ...)` 로 처리했는데, ProseMirror 는 view 생성 시점에 같은 DOM 에 자기 paste 리스너를 먼저 등록한다 → **PM 기본 paste(HTML 삽입)가 항상 먼저 실행**되고, 그 뒤에 실행되는 우리 리스너의 `preventDefault()` 는 무력. 파일만 있는 클립보드(스크린샷)에선 PM 이 할 일이 없어 우연히 정상 동작해 눈에 안 띄었다.
- **해결**: TipTap `editorProps.handlePaste`/`handleDrop` 사용 — PM 기본 처리 **이전**에 호출되고 `true` 반환으로 기본 처리를 차단한다. `editor` 인스턴스는 생성 시점 클로저에 없으므로 ref(`editorRef`)로 접근.
- **일반화**: 에디터 동작을 가로채려면 PM 파이프라인 안(`editorProps.handle*`, keymap)에서. DOM 리스너로 이기려면 캡처 단계 + `stopPropagation` 이 필요하다(Cmd+Enter 저장이 이 방식 — `editor.tsx` 주석 참조). 버블 단계 DOM 리스너는 PM 보다 항상 늦는다.

## 33. tiptap 은 전 패키지 lockstep — 부분 업그레이드는 ERESOLVE (2026-07-19)

tiptap v3 패키지들은 peer 로 `@tiptap/core@정확버전`(캐럿 아님)을 핀한다. 일부만 올리면
설치된 core(구버전)와 충돌해 `npm install` 이 ERESOLVE 로 실패하고, 이미 어긋난 lockfile
상태에선 전 패키지를 한 명령으로 핀해도 실패한다. **해결: `@tiptap/*` 전부를 package.json
에서 같은 마이너로 올린 뒤 `rm -rf node_modules package-lock.json && npm install`(클린
재설치).** 신규 tiptap 확장을 추가할 때도 기존 세트와 같은 버전으로 맞출 것.
`npm ls @tiptap/core` 로 단일 버전인지 확인한다(2개 버전이 공존하면 스키마/플러그인이
조용히 어긋난다).

## 34. Select 트리거는 `SelectValue` 에 `min-w-0` 이 없으면 긴 라벨이 넘친다 (2026-07-19)

- **증상**: 태스크/에픽/프로젝트 생성·수정 다이얼로그에서 상위 항목(에픽/프로젝트/스프린트) 셀렉트에 **긴 제목**을 고르면 텍스트가 트리거 박스를 뚫고 나가 다이얼로그 레이아웃이 깨졌다.
- **원인**: `ui/select.tsx` 의 `SelectValue` 가 `flex flex-1` 인데 `min-w-0` 이 없었다. flex 자식은 기본 `min-width:auto` 라 내용(선택 텍스트)보다 작게 못 줄어든다 → 안쪽 `truncate`/`line-clamp-1` 이 무력화되고, 트리거의 min-content 가 "전체 텍스트 폭"이 된다. `SelectTrigger` 는 `w-fit`+`whitespace-nowrap` 이라 폭 제한이 없으면 `w-fit` 이 셀 폭으로 수렴하지 못하고 그리드 셀 밖으로 넘친다.
- **왜 폼에서만**: 필터(`owner/team-filter` `w-40`)·상세 인라인(`max-w-44`)·멤버-팀(`w-44`) 은 `triggerClassName` 으로 폭을 고정/제한해 덜 티났다. **폼 래퍼(`fields.tsx`)만 폭 제한 없이 기본 `w-fit`** 이라 터졌다.
- **해결**: (1) `SelectValue` 에 `min-w-0` 추가(공유 근본 — 모든 셀렉트에서 truncate 활성화). (2) 폼 셀렉트 5종(`fields.tsx` 의 Status/Priority/Member/Team/Generic)에 `triggerClassName="w-full"` — 폼 필드는 Input/날짜와 동일하게 폭을 채우고 긴 텍스트는 안에서 truncate.
- **일반화**: flex 컨테이너 안에서 자식이 truncate 되게 하려면 그 자식(또는 체인상의 flex 자식)에 `min-w-0` 이 필수. `overflow-hidden`/`truncate` 만으론 안 줄어든다.

## 35. 중앙 정렬 `fixed` 다이얼로그는 `max-h`+`overflow` 없으면 상하가 잘려 접근 불가 (2026-07-20)

- **증상**: 모바일에서 스프린트/프로젝트/에픽/태스크 **생성 다이얼로그의 상하가 잘려 아무 액션도 못 함**(제목·저장/취소가 화면 밖).
- **원인**: `ui/dialog.tsx` 의 `DialogContent` 가 `fixed top-1/2 -translate-y-1/2` 로 중앙 정렬인데 `max-height`·`overflow` 가 없었다. 내용이 뷰포트보다 길면 위아래로 **균등하게** 삐져나가고, `fixed` 라 페이지 스크롤로도 닿지 못한다. 데스크톱은 뷰포트가 높아 안 드러남 → 모바일 전용처럼 보이는 버그.
- **해결**: 팝업 자체를 스크롤 컨테이너로. `max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain`. `vh` 가 아니라 **`dvh`** — 모바일 주소창이 접히고 펴질 때 `vh` 는 안 따라와 여전히 잘린다. `overscroll-contain` 은 끝까지 스크롤했을 때 뒤 페이지가 딸려 스크롤되는 것(scroll chaining) 방지.
- **함정 A — sticky 오프셋은 스크롤 컨테이너의 padding 만큼 이미 inset 된다**: `DialogFooter` 는 `-mx-4 -mb-4` 로 팝업 padding(`p-4`)을 상쇄해 가장자리에 붙는다. 이걸 `sticky` 로 바닥 고정할 때 음수 마진을 되돌리려 `bottom-4` 를 주면 **16px 이 이중 상쇄**돼 푸터가 팝업 하단에서 32px 뜬다(`bottom-0` 이면 16px). 브라우저가 sticky 제약 사각형을 스크롤 컨테이너 padding 만큼 이미 inset 하기 때문. **정답은 `-bottom-4`**(= `bottom:-16px`) — 실측으로 gap 0(=`rounded-b-xl` 모서리 정렬) 확인. 이론으로 추측하지 말고 `getBoundingClientRect` 로 재라.
- **함정 B — sticky 요소 배경은 불투명이어야 한다**: 푸터가 `bg-muted/50`(반투명)이면 고정된 채 아래로 지나가는 폼 내용이 비친다. 불투명 `bg-muted`(인셋 면 `#f5f5f5`)로.
- **함정 C — tailwind-merge 는 `overflow` 와 `overflow-y` 를 다른 그룹으로 본다**: `DialogContent` 기본값에 `overflow-y-auto` 가 생기자, 이를 `overflow-hidden` 으로 덮어쓰던 `ui/command.tsx`(커맨드 팔레트)가 **computed `overflow-y:auto`** 로 남았다(shorthand 가 longhand 를 못 이김). 공용 프리미티브 기본값에 축별 유틸을 넣으면, 이를 shorthand 로 덮던 소비자를 함께 축별(`overflow-x-hidden overflow-y-hidden`)로 고쳐야 한다.
- **함정 D — 오프셋 배치 팝업은 높이 상한도 오프셋을 빼야 한다**: 중앙 정렬이 아니라 `top-[15vh]` 처럼 위에서 띄워 놓는 팝업(⌘K 커맨드 팔레트)에 `max-h-[calc(100dvh-2rem)]`(중앙 정렬 전제)을 그대로 물려주면, **오프셋만큼 하단이 화면 밖으로 나간다.** 짧은 뷰포트에서만 발현해서 놓치기 쉽다(높이 386px 가로모드 폰에서 25px, 300px 에서 12px 잘림 실측). 상한은 "그 아래 남은 공간" 기준으로 — `top-[15dvh] max-h-[calc(85dvh-1rem)]`. 또한 이런 팝업의 `overflow` 는 **y 를 hidden 으로 막지 말 것** — 아주 짧은 뷰포트에서 내용에 닿을 수 없어진다. x 만 hidden 하고 y 는 auto 로 degrade.
- **참고 — 이미 안전한 곳(재조사 불필요)**: 넓은 콘텐츠는 전부 가로 스크롤 래퍼가 있다 — 표 `ui/table.tsx:11`(`overflow-x-auto`), 칸반 `board/kanban.tsx:217`(`flex overflow-x-auto` + 컬럼 `w-72 shrink-0`), 타임라인 `timeline/epic-timeline.tsx:253`. 위키 이미지 라이트박스는 `max-h-full max-w-full object-contain`, 버전기록 다이얼로그는 `h-[70vh]`(항상 뷰포트 내). Base UI/floating-ui Positioner 를 쓰는 select·dropdown·tooltip 은 자동으로 뷰포트에 맞춰지므로 이 부류 버그가 없다.
- **검증 방법은 [CLAUDE.md "반응형·CSS 변경 검증법"](../CLAUDE.md#반응형css-변경-검증법-로그인-게이트-우회) 참조**(중복 방지 — 절차 정본은 그쪽 한 곳). 이 §35 를 만들면서 **거기 적힌 3가지 함정에 전부 직접 걸렸다**: Tailwind JIT 미생성 클래스(→ "sticky 가 안 먹는다"는 오진), twMerge 미적용 문자열(→ base `max-h` 가 이겨 "수정안이 더 나쁘다"는 오진), 창 리사이즈 미반영(→ 모바일 폭 테스트가 실은 데스크톱 폭이었음). **측정값이 뷰포트를 바꿔도 동일하면 클래스가 안 먹은 것**이라고 의심할 것.
