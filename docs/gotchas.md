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

## 8. 스키마 특이사항 (현행)

- 이슈 key는 **팀 단위 연속 시퀀스**(`Team.seq` 원자 증가, `src/server/keys.ts` `nextTeamNumber`, 트랜잭션 필수). 표시는 `formatIssueKey(teamKey, number)`.
- Task는 생성 시 Epic의 `teamId`를 상속·고정(에픽 이동에도 key 불변). 팀/번호는 update에서 strip.
- 위키: `WikiPage`(parent 중첩) + `WikiFolder`(별개 그룹핑 타입), `WikiPageTaskLink`(티켓↔위키), `WikiRevision`(버전). `Activity`(범용 변경 로그, entityType/entityId/meta).
