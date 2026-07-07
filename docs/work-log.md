# 작업 로그

세션 단위로 무엇을·왜 바꿨는지 기록한다. 최신 항목이 위.

---

## 2026-07-08 — DESIGN.md 반영(near-white 테마 이관) + 목록 행 리팩터링

### 1. 테마 이관: Intercom cream → Vercel near-white

DESIGN.md가 Vercel 계열 near-white 라이트 전용으로 정의됨에 따라, 기존 cream 테마를 이관.

- **`src/app/globals.css`**: `:root` 색 토큰 전면 리매핑.
  - 캔버스 `#f5f1ec`(cream) → `#fafafa`(canvas-soft), 카드 `#ffffff` 유지, 인셋 `#f5f5f5`, 잉크 `#171717`, 헤어라인 `#ebebeb`.
  - `--muted-foreground` `#4d4d4d`(body), `--destructive` `#ee0000`, 신규 `--link` `#0070f3`.
  - 차트 색(`--chart-1..5`)을 브랜드 그라디언트 팔레트로 교체.
  - `--fin-orange`(구 Fin 액센트) 제거.
  - heading tracking `-0.02em` → `-0.025em`(브랜드 보이스 강화).
  - tiptap 인라인 링크 색을 `var(--primary)` → `var(--link)`.
- **`src/app/layout.tsx`**: 다크→라이트 정합화. `<html>`에서 `.dark` 클래스 제거, Toaster `theme="dark"` → `"light"`. (이전엔 `.dark` 클래스인데 `:root`는 라이트 값이라 어긋난 상태였음 — `.dark` 오버라이드 블록이 없어 실제로는 cream이 렌더됨.)
- **`src/lib/constants.ts`**: 상태·우선순위 색을 흰 배경 대비용으로. 텍스트 `-300/-400` → `-600`대, 중립 상태는 neutral 그레이, dot은 채도 유지(`-500`).
- **`src/components/timeline/epic-timeline.tsx`**: today 마커 `bg-red-400` → `bg-red-500`(흰 배경 가독성).
- **`src/app/login/page.tsx`**: 카드 `border-none shadow-lg`(DESIGN.md의 heavy drop-shadow 금지 위반) → `shadow-sm`(inset hairline ring 유지).

검증: `npm run build` 통과(Compiled successfully, TypeScript OK). 실행 중 dev 서버가 `--background: #fafafa` 서빙 확인.

### 2. 목록 행 중복 제거: `ItemRow` 추출

이니셔티브·에픽 목록의 Card-row가 두 파일에 복붙돼 있던 것을 공용 컴포넌트로 추출.

- **신규 `src/components/item-row.tsx`**: `ItemRow` + `RowMeta`. 고정 뼈대 공유 + `meta` 슬롯.
- **`src/app/(app)/initiatives/page.tsx`** / **`epics/page.tsx`**: 인라인 Card-row → `<ItemRow>`. 미사용 import 정리.
- 통일한 점: 키 컬럼 폭 `w-16/w-20` → `w-20`, 컬럼 순서 캐노니컬화(에픽의 상위 이니셔티브 라벨이 우선순위 배지 앞→뒤로 이동).

검증: build·TypeScript 통과. 신규/수정 파일에 lint 문제 없음(기존 `kanban.tsx` set-state-in-effect, `epic-timeline.tsx:77` 경고는 이번 작업과 무관한 선재 이슈).

### 알려진 관찰 사항(미수정)

- `ItemRow`의 `hover:border-primary/40`은 `Card`가 `border` 대신 `ring`을 쓰고 border-width가 0이라 **hover 효과가 실제로는 안 보이는 no-op**. 원본 유지. 필요 시 `hover:ring-primary/30`로 살릴 수 있음.
