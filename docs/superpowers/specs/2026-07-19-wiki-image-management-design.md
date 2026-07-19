# 위키 이미지 관리 강화 설계

2026-07-19. 승인: 구현 방식 A(NodeView 확장) + 추가 기능 3종 포함.

## 목표

위키 본문 이미지에 다음 기능을 추가한다.

1. 편집 모드: 드래그 핸들로 이미지 크기 조절
2. 뷰 모드: 더블클릭 시 라이트박스 확대
3. 정렬: 왼쪽/가운데/오른쪽 (블록 정렬, 텍스트 감싸기 없음)
4. 라이트박스에서 원본 새 탭 열기 / 다운로드
5. alt(대체 텍스트) 편집

## 현재 상태

- `extensions.ts:99-102`에서 순정 `@tiptap/extension-image`(v3.27.1)를
  `class: wiki-image`로만 구성. NodeView·width·정렬 없음.
- 에디터(`editor.tsx`)/뷰(`wiki-view.tsx`)/공지/댓글 뷰가 `wikiExtensions()`
  한 세트를 공유 — 확장을 한 곳만 바꾸면 전부 반영된다.
- React NodeView 선례: `mermaid-block.tsx`(atom NodeView), `code-block.tsx`.
- 업로드 경로(붙여넣기/드롭/툴바 + placeholder 추적)는 기존 그대로 유지.

## 설계

### 새 파일 `src/components/wiki/image-view.tsx`

`Image.extend()` + `ReactNodeViewRenderer(ImageView)` 자기완결 모듈.
`extensions.ts`에서는 기존 `Image.configure(...)` 한 줄을 새 `WikiImage`로 교체.

노드 이름은 `image` 유지(기존 문서 JSON 그대로 파싱).

#### attrs

| attr | 타입 | 기본 | 비고 |
| --- | --- | --- | --- |
| `src`, `alt`, `title` | 기존 | 기존 | 순정 그대로 |
| `width` | number \| null | null | px. null = 원본 크기(본문 폭 캡) |
| `align` | "left" \| "center" \| "right" | "left" | 블록 정렬 |

- `renderHTML`: `width` 속성 + `data-align` 으로 직렬화(복붙 라운드트립).
- `parseHTML`: `width` 속성/`style` 의 px, `data-align` 복원.
- 기존 문서(width/align 없음)는 지금과 동일하게 렌더 — 마이그레이션 불필요.

#### ImageView (NodeView)

- `NodeViewWrapper`(block) > `img[data-drag-handle]`. wrapper 에
  `data-align` 을 얹고 CSS 로 정렬(왼쪽 기본, 가운데/오른쪽은 margin auto).
- 편집 모드 + 선택 시:
  - 이미지 좌우 모서리에 리사이즈 핸들. 드래그 중에는 로컬 state 로만
    시각 반영, `pointerup` 에 한 번 `updateAttributes({ width })`
    (undo 1 스텝, 히스토리 오염 방지). 최소 80px, 최대는 CSS
    `max-width:100%` 캡. 종횡비는 `height:auto` 로 자동 유지.
  - 이미지 상단에 작은 컨트롤 바(mermaid 바 패턴): 정렬 3버튼,
    원본 크기(width 리셋), alt 입력 토글. alt 는 바 안 인라인 인풋으로
    편집(BubbleToolbar 의 모드 전환 패턴, 포털 없음).
- 뷰 모드(읽기전용): 더블클릭 → 라이트박스. 핸들/바 미렌더.

#### 라이트박스

- NodeView 내부에서 `createPortal(document.body)` 로 렌더.
- `fixed inset-0 z-50` + 어두운 배경, 이미지 `max-w/max-h ≈ 90vw/90vh` 중앙.
- 닫기: 배경 클릭, ESC, 닫기 버튼.
- 액션: 새 탭에서 원본 열기(`window.open(src)`), 다운로드(`<a download>`).
- 열려 있는 동안 body 스크롤 잠금.

### CSS (`globals.css`)

- 기존 `.tiptap img.wiki-image` 유지.
- 추가: wrapper 정렬(`data-align`), 리사이즈 핸들, 선택 상태 outline 을
  NodeView wrapper 기준으로 이동. 라이트박스는 컴포넌트 Tailwind 클래스로 처리.

### 에러 처리

- 업로드 실패/삭제된 이미지: `img` `onError` 시 깨진 아이콘 대신 기존
  브라우저 기본 동작 유지(범위 밖 — 후속).
- 드래그 중 `pointercancel` 에도 전역 리스너 정리(editor.tsx 의
  `resizeByDrag` 와 동일한 함정 대응).

### 테스트

- width 클램프·attrs 파싱 등 순수 로직은 `image-view` 에서 분리 가능한
  형태로 두고 vitest 유닛 테스트 추가.
- 수동 검증: 편집(리사이즈·정렬·alt) → 저장 → 뷰(크기·정렬 유지,
  더블클릭 확대) → 버전 미리보기·공지·댓글 뷰 회귀 확인.

## 범위 밖 (후속 백로그)

- 캡션(figure/figcaption) — 스키마 변경 폭이 커서 별도 작업.
- 서버측 이미지 최적화(리사이즈/압축, orphan 파일 정리).
- 편집 모드 더블클릭 확대(요구는 뷰 모드만).
