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
  - 카드는 `rounded.lg`(12px), 버튼/인풋은 작은 반경(6–8px). 마케팅 100px pill CTA 형태는 in-product 화면에 쓰지 않는다.
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
- **`unstable_cache` 로 감싼 공유 쿼리는 mutating 액션에서 `bumpTags`(=Next 16 `updateTag`) 필수.** `queries.ts` 의 목록/옵션/트리 14개가 `src/lib/cache.ts` 태그로 캐시됨(D3). 새 캐시 쿼리를 추가하거나 표시 필드를 바꾸면 **교차 엔티티 의존성까지** 무효화 배선을 갱신해야 스테일이 안 남는다. `revalidateTag(tag,{expire:0})` 는 stale-while-revalidate 라 mutation 직후 "한 번 더 요청해야 반영되는" off-by-one 을 유발 → read-your-own-writes 는 `updateTag`(Server Action 전용, 즉시 하드 만료). [gotchas §13].

## 테스트

- **Vitest 유닛 테스트 존재**: `npm run test`(= `vitest run`). 대상은 순수 로직 모듈(`src/lib/*.test.ts` — validators·rich-content·constants·activity-format). `keys.ts`의 DB 바운드 함수(`nextTeamNumber`)는 미커버(순수 `formatIssueKey`만). **코드 수정 시 관련 테스트 실행·추가**. (Playwright 스모크는 아직 없음 — 후속.)

## in-product 공용 기능(참고)

- **전역 검색/⌘K**: `command-palette.tsx`(토픽바 마운트, `queries.globalSearch` + `globalSearchAction`). 새 엔티티 추가 시 검색 그룹에 반영 고려.
- **라벨**: `Label` 스키마를 태스크에 표면화(`/labels` 관리, 부여 팝오버, `?label=` 필터, 색 뱃지). 에픽·프로젝트 라벨 부여는 스키마만 있고 UI 미구현(후속).
- **위키 리치 렌더링**: `wikiExtensions()`(에디터·뷰 공유)에 표(`TableKit`)·구문강조 코드(`CodeBlockLowlight`)·mermaid(`MermaidBlock` atom NodeView, 지연 로드) 포함. 확장은 이 한 곳에만 추가. 함정은 [gotchas §18].
- **알림 벨**: `notification-bell.tsx`가 45s 폴링(`getBellNotifications`). 실시간 소켓 아님.
- **태스크 의존성**: `TaskDependency`(blocker→blocked 방향). 상세 사이드바 `task-dependencies.tsx`에서 '차단됨/차단함' 편집. 순환은 `lib/task-deps.wouldCreateCycle`로 서버에서 거부. 방향/함정은 [gotchas §17].
- **에러/로딩 바운더리**: `(app)/error.tsx`·`loading.tsx`가 하위 전 세그먼트 상속(루트 `global-error.tsx`는 극단 안전망). 새 세그먼트는 필요 시에만 자체 추가.
