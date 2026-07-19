@AGENTS.md

## 디자인 작업 규칙

!IMPORTANT: **UI·디자인·스타일 관련 작업(컴포넌트 스타일, 색상, 타이포그래피, 여백, 레이아웃, 테마 등)을 할 때는 반드시 프로젝트 루트의 [`DESIGN.md`](./DESIGN.md)를 먼저 참고**하고 그 디자인 시스템에 맞춰 구현한다.

- **디자인 시스템**: Vercel 계열 **near-white 라이트 전용** 테마. canvas-soft 캔버스(`#fafafa`) + 순수 흰색 카드(`#ffffff`) + 인셋 면(`#f5f5f5`) + hairline 보더(`#ebebeb`) + ink 텍스트/primary(`#171717`) + 링크 블루(`#0070f3`). (구 Linear 다크 테마에서 이관됨.)
- **토큰 소스**: 색상·타이포·radius·spacing 값은 `DESIGN.md`의 front matter(`colors`/`typography`/`rounded`/`spacing`)와 `components:` 정의를 정본으로 삼는다. 임의로 새 색을 만들지 말 것.
- **적용 위치**: 전역 토큰은 `src/app/globals.css`의 CSS 변수(shadcn/Base UI 시맨틱 토큰 `--background`/`--card`/`--primary`/`--border` 등)에 매핑돼 있다. 색을 바꿀 땐 하드코딩 대신 이 변수를 통해 반영한다. 토큰↔코드 매핑 상세는 [`docs/design-system.md`](./docs/design-system.md).
- **핵심 원칙**(DESIGN.md Do/Don't 요약):
  - 잉크(`#171717`)가 **단일 primary/CTA**. 링크 블루(`#0070f3`)는 인라인 링크 강조에만 희소하게.
  - 깊이는 그림자가 아니라 **surface ladder(#fafafa→#ffffff→#f5f5f5) + inset hairline ring**으로 표현. 무거운 단일 drop-shadow 금지.
  - 여섯 번째 채도 높은 액센트를 새로 도입하지 않는다. (상태/우선순위 태그 색은 in-product 예외)
  - 카드는 `rounded.lg`(8px), 버튼/인풋은 작은 반경(5–6px). round 는 살짝만 준다(과거 12px 카드에서 축소). 마케팅 100px pill CTA 형태는 in-product 화면에 쓰지 않는다.
  - 라이트 전용(다크 모드는 만들지 않는다). `<html>`에 `.dark` 클래스를 붙이지 않는다.

## 프로젝트 문서(docs) 라우팅

작업 맥락이 필요하면 코드를 뒤지기 전에 [`docs/`](./docs/) 를 먼저 참고한다. 인덱스: [`docs/README.md`](./docs/README.md).

- **디자인 시스템 구현**(토큰 매핑·테마·`ItemRow` 등 공용 패턴): [`docs/design-system.md`](./docs/design-system.md)
- **엔지니어링 함정/주의사항**(아래 필독 섹션의 상세): [`docs/gotchas.md`](./docs/gotchas.md)
- **변경 이력**(무엇을·왜 바꿨나): [`docs/work-log.md`](./docs/work-log.md)
- **예정/백로그 작업**(스코핑·열린 질문): [`docs/roadmap-v2.md`](./docs/roadmap-v2.md) — 현행 백로그. Phase 1~4 이력은 [`docs/roadmap.md`](./docs/roadmap.md)

새 문서를 추가하면 `docs/README.md` 인덱스와 이 라우팅 목록도 함께 갱신한다.

## 엔지니어링 주의사항 (필독 — 실제로 물렸던 함정)

상세·전체 목록은 [`docs/gotchas.md`](./docs/gotchas.md). 반복적으로 물린 핵심만:

- **스키마 변경 후 dev 서버 재시작 필수.** `next dev`는 옛 Prisma client를 메모리에 물고 있어, `migrate`+`generate` 후에도 재시작 전엔 `prisma.<model>` undefined 런타임 에러. **"DB 연결 오류"로 오인 금지** — 재시작으로 해결.
- **병합 후 `npx prisma generate`.** 스키마 브랜치 병합 시 client 자동 재생성 안 됨 → `Property 'X' does not exist on PrismaClient` 타입 에러.
- **폼은 미선택/빈 값에 `null`을 보낸다.** zod optional 필드는 `.optional()`(=undefined만) 말고 **`.nullish()`** 로 — 안 그러면 create/update 전부 ZodError로 저장 실패.
- **git worktree + Turbopack**: worktree의 symlink node_modules는 `next build`/`dev`가 거부. worktree 검증은 **`tsc --noEmit`+`eslint`만**, 통합 빌드는 병합 후 main에서. worktree에서 추가한 npm 의존성은 물리설치 누락되니 병합 후 main에서 `npm install`.
- **엔티티 드롭다운은 `OptionSelect`**(`src/components/selects/option-select.tsx`) 사용 — Base UI `SelectValue`는 render 함수 없으면 원시 id/enum을 노출한다.
- **`Card` 여백**: 기본 `py`+`gap`이 있으므로 `CardContent`에 py 중복 금지(`py-0`), `divide-y` 리스트는 `gap-0` override. (여백 버그 단골)
- **`.worktrees/` 는 eslint에서 ignore됨**(`eslint.config.mjs` `globalIgnores`, B6). 병렬 worktree 사본이 더 이상 lint 결과를 부풀리지 않는다. (과거엔 경로 필터가 필요했음.)
- **병렬 서브에이전트 산출물은 병합 전 NUL/비-UTF8 스캔.** 에이전트가 sentinel 등으로 NUL(`"\x00"`)을 코드에 박으면 tsc/eslint는 통과하지만 git이 파일을 **바이너리로 인식**(`git diff --stat`에 `Bin ...`) → 실제로 물렸음. [gotchas §9](./docs/gotchas.md).
- **위키 페이지 조회엔 항상 `where: { deletedAt: null }`**(soft-delete 휴지통 유출 방지). 전역 검색(`globalSearch`)·목록·트리 모두 해당. [gotchas §8].
- **공유 목록/옵션/트리 쿼리는 `unstable_cache` 로 감싸지 않는다(2026-07-13 제거).** 과거 `queries.ts` 14개를 `src/lib/cache.ts` 태그로 캐시하고 `bumpTags`(=`updateTag`)로 무효화했으나, **prod 는 `replicas: 2` 인데 공유 `cacheHandler` 가 없어** `unstable_cache` 가 **pod 별 로컬 캐시**였다 → mutation 이 처리된 pod 만 무효화되고 이어지는 `router.refresh()` 가 다른 pod 로 가면 stale(위키 저장 후 좌측 사이드바 제목이 간헐적으로 안 바뀌던 버그의 근본원인). dev·단일 인스턴스에선 재현 안 됨. **해결: 캐시 레이어 자체를 제거** — 이제 공유 쿼리는 매 렌더 DB 직접 조회(공유 DB라 항상 fresh, 20인 규모 부하 무시가능). `revalidatePath`/`router.refresh()` 만으로 read-your-own-writes 보장(force-dynamic + 클라이언트 라우터 캐시 staleTime 0). **재도입 금지**: 멀티 replica 인 채로 `unstable_cache` 를 다시 쓰려면 반드시 Redis 등 공유 `cacheHandler` 를 함께 설정. [gotchas §13].

## 테스트

- **Vitest 유닛 테스트 존재**: `npm run test`(= `vitest run`). 대상은 순수 로직 모듈(`src/lib/*.test.ts` — validators·rich-content·constants·activity-format). `keys.ts`의 DB 바운드 함수(`nextTeamNumber`)는 미커버(순수 `formatIssueKey`만). **코드 수정 시 관련 테스트 실행·추가**. (Playwright 스모크는 아직 없음 — 후속.)

## in-product 공용 기능(참고)

- **전역 검색/⌘K**: `command-palette.tsx`(토픽바 마운트, `queries.globalSearch` + `globalSearchAction`). 새 엔티티 추가 시 검색 그룹에 반영 고려.
- **라벨**: `Label` 스키마를 태스크에 표면화(`/labels` 관리, 부여 팝오버, `?label=` 필터, 색 뱃지). 에픽·프로젝트 라벨 부여는 스키마만 있고 UI 미구현(후속).
- **위키 리치 렌더링**: `wikiExtensions()`(에디터·뷰 공유)에 표(`TableKit`+`TableControls`+`table-cells.ts` 배경색 셀)·구문강조 코드(`CodeBlockLowlight`)·mermaid(`MermaidBlock` atom NodeView, 지연 로드)·글자색/배경색(`TextStyle`+`Color`+`BackgroundColor`)·정렬(`TextAlign`, heading/paragraph)·슬래시 커맨드(`SlashCommand`) 포함. 확장은 이 한 곳에만 추가. tiptap 은 **전 패키지 lockstep**(3.28) — 부분 업그레이드는 peer 정확핀 때문에 ERESOLVE. 함정은 [gotchas §18].
  - **이미지**(`image-view.tsx` NodeView + `image-utils.ts`): 편집 모드 선택 시 좌우 드래그 핸들 리사이즈(px, `attrs.width`, 최소 80px)·정렬 3버튼(`attrs.align`, 블록 정렬)·ALT 인라인 입력, 뷰 모드 더블클릭 라이트박스(원본 열기/다운로드). 노드 이름 `image` 유지(기존 문서 호환), width 는 `<img width>` 로 직렬화. width 커밋은 pointerup 1회(undo 1스텝).
  - **생성 모드/초안**: UI '새 페이지'는 `WikiPage.isDraft=true` 로 생성 → `/wiki/{id}?edit=1`(편집 모드+제목 포커스, Enter/↓ 본문 이동). 첫 저장 시 정식 전환. 초안은 **작성자에게만** 노출(트리 흐림+[초안], 검색/링크검색 제외, 타인 URL `notFound`), 초안 하위 페이지 생성 불가. MCP/API 생성은 초안 아님.
  - **색상/정렬 팔레트**: 정본은 `colors.ts`(`TEXT_COLORS` 10·`BG_COLORS` 9·`CELL_COLORS`) — 툴바/버블/표 메뉴가 공유, 새 색은 여기에만. 정렬은 툴바 팝오버+버블 3버튼.
  - **줄(블록) 핸들**(`block-handle.tsx`): `@tiptap/extension-drag-handle-react`. 클릭=블록 NodeSelection+복제/삭제 메뉴, 드래그=이동. WikiEditor 전용(뷰에는 없음).
  - **표 배경색/선택**: 셀 배경 attr 은 `table-cells.ts`(TableKit 의 tableCell/tableHeader 는 꺼서 교체). 셀 배경=우클릭 메뉴, 헤더 일괄=표 팝오버(`setHeaderRowBackground`), 열/행 선택=상단/좌측 hover 스트립(`selectColumn`/`selectRow`).
  - **슬래시 커맨드(/)**: `slash-command.ts`(`@tiptap/suggestion` 기반 Extension) + `slash-menu.tsx`(목록/필터). 제목1~6·글머리/번호/체크 목록·인용·코드·표·mermaid·구분선. 커맨드 추가는 `SLASH_ITEMS`(slash-menu) 한 곳에. 코드블록 내부·단어 중간 `/` 는 트리거 제외(`allow`).
  - **제목/툴바**: heading `levels:[1..6]`(`#` 개수만큼 h1~h6). 편집 툴바엔 H1/H2/H3·목록/체크 아이콘 없음 — 제목·목록은 `#`/`-`/`1.`/`[ ]` 또는 슬래시로. 툴바 아이콘 툴팁은 Base UI `Tooltip`(≈150ms), 네이티브 `title` 아님.
  - **저장/취소는 에디터가 아니라 헤더에**: `WikiEditor` 는 `forwardRef`+`useImperativeHandle({commit,cancel})`+`onStateChange`. `WikiDetail` 의 sticky 헤더(`...` 메뉴 좌측)에서 호출 — 긴 본문 스크롤에도 고정.
  - **코드블록**(`code-block.tsx` NodeView + `code-block-pairs.ts`): 우측 상단 복사 버튼·언어 select(Plain/Kotlin/Java/JSON/YAML/iOS-Swift, lowlight `common`), 괄호·따옴표 자동 닫기, Enter 자동 들여쓰기(`{`·`[` +1단, 그 외 유지). 코드블록 안 `#`/`@`/`/` 는 트리거 안 됨(Suggestion `allow`). `extend` 시 `this.parent` 로 lowlight·베이스 단축키 보존 필수. 강조 색은 `globals.css` `.hljs-*`. [gotchas §27]
  - **표 편집**: 삽입 버튼은 hover 크기 그리드 픽커(최대 8×8). 표 안이면 우측/하단 hover 스트립 `+` — 클릭/드래그 추가는 **항상 마지막 행/열 뒤**(`table-edit.ts` `appendRowEnd`/`appendColumnEnd`), **반대 방향 드래그로 삭제**(빈 행/열까지만). 셀 **우클릭 컨텍스트 메뉴**(`table-context-menu.tsx`: 셀=좌/우 열·위/아래 행 추가+삭제, 행/열 전체 선택 시 전용 메뉴). 단축키(`table-controls.ts`): `Ctrl+Opt+←/→/↑/↓` 커서 기준 열/행 추가, 행/열 전체 선택 후 `Ctrl+Backspace` 삭제(표 전체면 표 삭제). `ArrowLeft`→표 선택→`Backspace` 삭제, 리사이즈는 표 폭 고정(경계선만 이동, CSS `!important`). [gotchas §29]
  - **휴지통**(`trash-list.tsx`): 행 `Checkbox` 다중 선택 → `purgeWikiPages(ids)` 다중 삭제, `emptyWikiTrash()` 비우기. 둘 다 `canManage`(작성자/ADMIN) 통과분만 삭제(권한 없는 항목 건너뜀).
- **목록 행 우클릭 메뉴**: `tables/row-context-menu.tsx`의 `RowContextMenu`가 목록 표 행(tasks/epics/projects/sprints)에 좌클릭=상세 열기 + 우클릭=컨텍스트 메뉴(열기·새 창에서 열기·삭제)를 준다. 삭제는 controlled `ConfirmDelete`로 확인 후 실행. 삭제 서버 액션은 표(서버 컴포넌트)에서 `deleteAction` prop으로 주입해 `deleteAction(id)`로 호출한다. 기존 `RowOpenSheet`/`TableRowLink`를 대체.
- **멘션**: '@' suggestion(`person-mention.tsx`)이 멤버+**팀**을 함께 노출(`searchMentionTargets`). 팀 선택 시 `teamMention` 노드(`team-mention.tsx`) 삽입, 저장 시 서버(`notify.newMentionRecipients`)가 팀원 전원으로 확장해 알림. 새 멘션 종류를 추가하면 `lib/mentions.ts` 추출기와 `rich-content.docToPlainText` 도 함께.
- **공지**: `Announcement` 모델 + 대시보드 최상단 카드 + `/announcements`(목록)·`/announcements/[id]`(상세, `?edit=1`=편집 진입). 에디터는 위키 구성요소 재사용(`announcement-editor.tsx`), draft 없음. 수정은 전원, **삭제는 작성자만**(author null 이면 ADMIN).
- **서버 캐시**: `lib/server-cache.ts`(TTL 인메모리, pod-local). 검색/멘션 자동완성만 적용 — 적용처 확장 전 [gotchas §13] 예외 조건 필독.
- **알림 벨**: `notification-bell.tsx`가 45s 폴링(`getBellNotifications`). 실시간 소켓 아님.
- **태스크 의존성**: `TaskDependency`(blocker→blocked 방향). 상세 사이드바 `task-dependencies.tsx`에서 '차단됨/차단함' 편집. 순환은 `lib/task-deps.wouldCreateCycle`로 서버에서 거부. 방향/함정은 [gotchas §17].
- **에러/로딩 바운더리**: `(app)/error.tsx`·`loading.tsx`가 하위 전 세그먼트 상속(루트 `global-error.tsx`는 극단 안전망). 새 세그먼트는 필요 시에만 자체 추가.
