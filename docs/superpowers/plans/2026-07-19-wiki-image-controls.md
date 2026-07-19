# 위키 이미지 관리 강화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위키 본문 이미지에 편집 모드 드래그 리사이즈·정렬·alt 편집, 뷰 모드 더블클릭 라이트박스(원본 열기/다운로드 포함)를 추가한다.

**Architecture:** `@tiptap/extension-image`(v3.27.1, width attr 내장)를 `Image.extend()`로 확장해 `align` attr을 더하고, React NodeView(`ImageView`) 하나가 편집 컨트롤(핸들·정렬/ALT 바)과 뷰 모드 라이트박스를 모두 담당한다. 에디터/뷰/공지/댓글이 `wikiExtensions()`를 공유하므로 `extensions.ts` 한 줄 교체로 전부 반영된다. 스펙: `docs/superpowers/specs/2026-07-19-wiki-image-management-design.md`.

**Tech Stack:** Tiptap v3 React NodeView(선례: `mermaid-block.tsx`), vitest(node 환경, 순수 로직만), Tailwind + `globals.css` 토큰.

---

### Task 1: 작업 브랜치 생성

**Files:** 없음 (git만)

- [ ] **Step 1: main 에서 새 브랜치 생성**

Run: `git checkout -b feat/wiki-image-controls`
Expected: `Switched to a new branch 'feat/wiki-image-controls'`

주의: `.mcp.json` 수정본과 `mcp/.omc/` 미추적 파일은 이 작업과 무관 — 커밋에 포함하지 않는다(항상 파일을 명시해 `git add`).

---

### Task 2: 순수 로직 `image-utils` (TDD)

**Files:**
- Create: `src/components/wiki/image-utils.ts`
- Test: `src/components/wiki/image-utils.test.ts` (vitest include: `src/**/*.test.ts`, node 환경 — DOM API 사용 금지)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/components/wiki/image-utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  IMAGE_MIN_WIDTH,
  normalizeAlign,
  parseWidthAttr,
  resizeWidth,
} from "@/components/wiki/image-utils";

describe("normalizeAlign", () => {
  it("center/right 는 그대로 통과한다", () => {
    expect(normalizeAlign("center")).toBe("center");
    expect(normalizeAlign("right")).toBe("right");
  });

  it("left·미지정·알 수 없는 값은 left 로 정규화한다", () => {
    expect(normalizeAlign("left")).toBe("left");
    expect(normalizeAlign(null)).toBe("left");
    expect(normalizeAlign(undefined)).toBe("left");
    expect(normalizeAlign("justify")).toBe("left");
  });
});

describe("parseWidthAttr", () => {
  it("숫자·숫자 문자열을 반올림한 px 로 파싱한다", () => {
    expect(parseWidthAttr(320)).toBe(320);
    expect(parseWidthAttr("320")).toBe(320);
    expect(parseWidthAttr("320.6px")).toBe(321);
  });

  it("비어 있거나 양의 유한수가 아니면 null(원본 크기)", () => {
    expect(parseWidthAttr(null)).toBeNull();
    expect(parseWidthAttr(undefined)).toBeNull();
    expect(parseWidthAttr("")).toBeNull();
    expect(parseWidthAttr("abc")).toBeNull();
    expect(parseWidthAttr(0)).toBeNull();
    expect(parseWidthAttr(-5)).toBeNull();
    expect(parseWidthAttr(Infinity)).toBeNull();
  });
});

describe("resizeWidth", () => {
  it("오른쪽 핸들은 +delta 로 커지고 왼쪽 핸들은 -delta 로 커진다", () => {
    expect(resizeWidth(300, 50, "right", 700)).toBe(350);
    expect(resizeWidth(300, 50, "left", 700)).toBe(250);
    expect(resizeWidth(300, -50, "left", 700)).toBe(350);
  });

  it("최소 IMAGE_MIN_WIDTH, 최대 maxWidth 로 클램프한다", () => {
    expect(resizeWidth(100, -500, "right", 700)).toBe(IMAGE_MIN_WIDTH);
    expect(resizeWidth(600, 500, "right", 700)).toBe(700);
  });

  it("maxWidth 가 최소값보다 작으면 maxWidth 가 우선한다", () => {
    expect(resizeWidth(100, -500, "right", 60)).toBe(60);
    expect(resizeWidth(100, 500, "right", 60)).toBe(60);
  });

  it("소수 좌표는 반올림한다", () => {
    expect(resizeWidth(300.4, 10.3, "right", 700)).toBe(311);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm run test -- src/components/wiki/image-utils.test.ts`
Expected: FAIL — `Cannot find module '@/components/wiki/image-utils'` 류 에러.

- [ ] **Step 3: 최소 구현 작성**

`src/components/wiki/image-utils.ts`:

```ts
/**
 * 이미지 리사이즈/정렬 순수 로직. image-view.tsx(NodeView)가 쓰며,
 * DOM 에 의존하지 않아 vitest node 환경에서 단위 테스트한다.
 */

export const IMAGE_MIN_WIDTH = 80;

export type ImageAlign = "left" | "center" | "right";

/** data-align 파싱: 알 수 없는 값·미지정은 left(기본 정렬)로 정규화. */
export function normalizeAlign(value: string | null | undefined): ImageAlign {
  return value === "center" || value === "right" ? value : "left";
}

/** width 속성/스타일 파싱: 양의 유한수만 반올림해 px 로, 그 외 null(원본 크기). */
export function parseWidthAttr(
  value: string | number | null | undefined,
): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/**
 * 드래그 리사이즈의 새 width(px). 오른쪽 핸들은 +delta, 왼쪽 핸들은 -delta 방향으로
 * 커지며 [IMAGE_MIN_WIDTH, maxWidth] 로 클램프한다. 컨테이너가 최소값보다 좁으면
 * maxWidth 가 우선(핸들이 화면 밖으로 나가지 않게).
 */
export function resizeWidth(
  startWidth: number,
  deltaX: number,
  side: "left" | "right",
  maxWidth: number,
): number {
  const raw = side === "right" ? startWidth + deltaX : startWidth - deltaX;
  const max = Math.max(1, Math.round(maxWidth));
  const min = Math.min(IMAGE_MIN_WIDTH, max);
  return Math.min(max, Math.max(min, Math.round(raw)));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- src/components/wiki/image-utils.test.ts`
Expected: PASS (4 describe, 전부 green)

- [ ] **Step 5: 커밋**

```bash
git add src/components/wiki/image-utils.ts src/components/wiki/image-utils.test.ts
git commit -m "feat(wiki): 이미지 리사이즈/정렬 순수 로직 image-utils 추가

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `WikiImage` 확장 + `ImageView` NodeView + 라이트박스

**Files:**
- Create: `src/components/wiki/image-view.tsx`

베이스 `@tiptap/extension-image` v3.27.1 은 `width`/`height` attrs 를 이미 갖고 있다(기본 직렬화 = `<img width="N">`). `width` 는 숫자 정규화만 얹고, `align` 은 새로 추가한다. 노드 이름은 `image` 그대로 — 기존 문서 JSON 마이그레이션 불필요.

- [ ] **Step 1: 파일 작성**

`src/components/wiki/image-view.tsx` 전체 내용:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "@tiptap/extension-image";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Download,
  ExternalLink,
  RotateCcw,
  X,
} from "lucide-react";
import {
  normalizeAlign,
  parseWidthAttr,
  resizeWidth,
  type ImageAlign,
} from "@/components/wiki/image-utils";

/**
 * 위키 본문 이미지 확장. 순정 Image(width attr 내장)에 정렬(attrs.align)을 더하고,
 * 편집 모드 리사이즈 핸들·정렬/ALT 바, 뷰 모드 더블클릭 라이트박스를 React
 * NodeView 로 제공한다. 노드 이름은 "image" 그대로라 기존 문서와 호환된다.
 * width 는 px 숫자로 정규화하며 <img width="N"> 으로 직렬화(복붙 라운드트립).
 */
export const WikiImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          parseWidthAttr(el.getAttribute("width") ?? el.style.width),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.width ? { width: attrs.width as number } : {},
      },
      align: {
        default: "left",
        parseHTML: (el: HTMLElement) =>
          normalizeAlign(el.getAttribute("data-align")),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.align === "center" || attrs.align === "right"
            ? { "data-align": attrs.align }
            : {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});

const ALIGNS: { value: ImageAlign; label: string; Icon: typeof AlignLeft }[] = [
  { value: "left", label: "왼쪽 정렬", Icon: AlignLeft },
  { value: "center", label: "가운데 정렬", Icon: AlignCenter },
  { value: "right", label: "오른쪽 정렬", Icon: AlignRight },
];

function ImageView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const src = (node.attrs.src as string | null) ?? "";
  const alt = (node.attrs.alt as string | null) ?? "";
  const width = node.attrs.width as number | null;
  const align = normalizeAlign(node.attrs.align as string | null);
  const editable = editor.isEditable;

  const frameRef = useRef<HTMLDivElement>(null);
  // 드래그 중 시각 피드백용 로컬 width. 커밋(updateAttributes)은 pointerup 1회 —
  // 이동마다 커밋하면 스텝 수만큼 undo 히스토리가 쌓인다.
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const [altOpen, setAltOpen] = useState(false);
  const [altDraft, setAltDraft] = useState("");

  function startResize(e: React.PointerEvent, side: "left" | "right") {
    // ProseMirror 의 노드 드래그/선택 개입 차단.
    e.preventDefault();
    e.stopPropagation();
    const frame = frameRef.current;
    if (!frame) return;
    const startX = e.clientX;
    const startWidth = frame.getBoundingClientRect().width;
    // 최대 폭 = 본문 컬럼 폭(NodeViewWrapper 블록). CSS max-width:100% 캡과
    // 일치하도록 저장값도 그 이상 커지지 않게 클램프한다.
    const maxWidth =
      frame.parentElement?.getBoundingClientRect().width ?? startWidth;
    let last = Math.round(startWidth);
    const onMove = (ev: PointerEvent) => {
      last = resizeWidth(startWidth, ev.clientX - startX, side, maxWidth);
      setDragWidth(last);
    };
    // pointercancel(터치 제스처·OS 개입)에도 전역 리스너를 정리한다 —
    // editor.tsx resizeByDrag 와 동일 함정.
    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", cleanup);
      setDragWidth(null);
    };
    const onUp = () => {
      updateAttributes({ width: last });
      cleanup();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", cleanup);
  }

  function openAlt() {
    setAltDraft(alt);
    setAltOpen(true);
  }

  function commitAlt() {
    updateAttributes({ alt: altDraft.trim() || null });
    setAltOpen(false);
  }

  const showControls = editable && selected;

  return (
    <NodeViewWrapper className="wiki-image-block" data-align={align}>
      <div
        ref={frameRef}
        className="wiki-image-frame"
        data-selected={showControls ? "" : undefined}
        style={{ width: dragWidth ?? width ?? undefined }}
      >
        {/* 본문 첨부 이미지는 업로드 산출물 same-origin URL — next/image 최적화 대상 아님. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="wiki-image"
          data-drag-handle
          draggable={editable}
          onDoubleClick={() => {
            if (!editable) setLightbox(true);
          }}
        />
        {showControls && (
          <>
            <span
              className="wiki-image-handle"
              data-side="left"
              contentEditable={false}
              aria-hidden
              onPointerDown={(e) => startResize(e, "left")}
            />
            <span
              className="wiki-image-handle"
              data-side="right"
              contentEditable={false}
              aria-hidden
              onPointerDown={(e) => startResize(e, "right")}
            />
            {/* 좌상단 오버레이 컨트롤(code-block 복사 버튼 패턴). */}
            <div className="wiki-image-bar" contentEditable={false}>
              {altOpen ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitAlt();
                  }}
                >
                  <input
                    autoFocus
                    value={altDraft}
                    onChange={(e) => setAltDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setAltOpen(false);
                    }}
                    placeholder="대체 텍스트"
                    aria-label="대체 텍스트"
                  />
                  <button type="submit">저장</button>
                </form>
              ) : (
                <>
                  {ALIGNS.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={label}
                      title={label}
                      data-active={align === value ? "" : undefined}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateAttributes({ align: value })}
                    >
                      <Icon className="size-3.5" />
                    </button>
                  ))}
                  {width != null && (
                    <button
                      type="button"
                      aria-label="원본 크기"
                      title="원본 크기"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateAttributes({ width: null })}
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="대체 텍스트 편집"
                    title="대체 텍스트"
                    data-active={alt ? "" : undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={openAlt}
                  >
                    ALT
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
      {lightbox && (
        <ImageLightbox src={src} alt={alt} onClose={() => setLightbox(false)} />
      )}
    </NodeViewWrapper>
  );
}

/**
 * 뷰 모드 더블클릭 확대 오버레이. body 포털 + ESC/배경 클릭 닫기, 열려 있는
 * 동안 body 스크롤 잠금. 원본 새 탭 열기/다운로드 액션 포함(same-origin URL).
 */
function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const chip =
    "flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "이미지 확대 보기"}
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-full max-w-full rounded-md object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <div
        className="absolute top-4 right-4 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <a className={chip} href={src} target="_blank" rel="noreferrer">
          <ExternalLink className="size-3.5" /> 원본
        </a>
        <a className={chip} href={src} download>
          <Download className="size-3.5" /> 다운로드
        </a>
        <button
          type="button"
          className={chip}
          onClick={onClose}
          aria-label="닫기"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: 타입 확인**

Run: `npx tsc --noEmit`
Expected: 에러 0 (image-view 관련). `parseHTML`/`renderHTML` 시그니처가 tiptap `Attribute` 타입과 안 맞으면 tiptap 의 `Attributes` 헬퍼 타입에 맞춰 캐스팅을 조정한다.

- [ ] **Step 3: 커밋**

```bash
git add src/components/wiki/image-view.tsx
git commit -m "feat(wiki): 이미지 NodeView - 리사이즈 핸들, 정렬/ALT 바, 라이트박스

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `extensions.ts` 배선 + `globals.css` 스타일

**Files:**
- Modify: `src/components/wiki/extensions.ts:11` (import), `:98-102` (Image.configure 교체)
- Modify: `src/app/globals.css:474-485` (기존 wiki-image 블록 교체 + 신규 규칙)

- [ ] **Step 1: extensions.ts 교체**

import 교체 (11행 `import Image from "@tiptap/extension-image";` 삭제 후):

```ts
// 본문 이미지 NodeView(리사이즈/정렬/alt/라이트박스). 자기완결 모듈, 여기 한 줄만 추가.
import { WikiImage } from "@/components/wiki/image-view";
```

`Image.configure({...})` 블록(98-102행)을 다음으로 교체:

```ts
    // 본문 이미지. base64 금지(업로드→URL 만 허용), 서빙 URL 은 same-origin.
    // 리사이즈/정렬/alt/라이트박스는 image-view.tsx 의 NodeView 가 담당.
    WikiImage.configure({
      allowBase64: false,
      HTMLAttributes: { class: "wiki-image" },
    }),
```

- [ ] **Step 2: globals.css 교체**

기존 474-485행(`/* 본문 첨부 이미지... */` 주석 + `.tiptap img.wiki-image` + `.ProseMirror-selectednode` 규칙)을 다음으로 교체. `.wiki-image-uploading` 블록(487행~)은 그대로 둔다.

```css
/* 본문 첨부 이미지(image-view.tsx NodeView). frame 이 이미지를 shrink-wrap 해
   핸들/오버레이의 기준이 되고, 정렬은 frame 의 margin 으로(블록 정렬, 텍스트
   감싸기 없음), 크기는 img 의 width(px) + max-width 캡으로 표현한다. */
.tiptap .wiki-image-block {
  margin: 0.5em 0;
}
.tiptap .wiki-image-block[data-align="center"] .wiki-image-frame {
  margin-inline: auto;
}
.tiptap .wiki-image-block[data-align="right"] .wiki-image-frame {
  margin-left: auto;
}
.tiptap .wiki-image-frame {
  position: relative;
  width: fit-content;
  max-width: 100%;
}
.tiptap .wiki-image-frame[data-selected] {
  outline: 2px solid color-mix(in oklch, var(--link) 40%, transparent);
  outline-offset: 2px;
  border-radius: 0.5rem;
}
.tiptap img.wiki-image {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
}
/* 읽기전용 뷰에서 더블클릭 확대 가능함을 커서로 알린다. */
.tiptap[contenteditable="false"] img.wiki-image {
  cursor: zoom-in;
}
/* 리사이즈 핸들(선택 시). 좌우 모서리 안쪽 pill. */
.tiptap .wiki-image-handle {
  position: absolute;
  top: 50%;
  width: 0.375rem;
  height: 2.5rem;
  max-height: 50%;
  transform: translateY(-50%);
  border-radius: 9999px;
  background: color-mix(in oklch, var(--foreground) 60%, transparent);
  box-shadow: 0 0 0 1px var(--background);
  cursor: ew-resize;
  touch-action: none;
}
.tiptap .wiki-image-handle[data-side="left"] {
  left: 0.375rem;
}
.tiptap .wiki-image-handle[data-side="right"] {
  right: 0.375rem;
}
/* 선택 시 좌상단 오버레이 컨트롤(정렬/원본 크기/ALT). */
.tiptap .wiki-image-bar {
  position: absolute;
  top: 0.375rem;
  left: 0.375rem;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 0.375rem;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--card) 92%, transparent);
}
.tiptap .wiki-image-bar button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--muted-foreground);
}
.tiptap .wiki-image-bar button:hover {
  background: var(--accent);
  color: var(--accent-foreground);
}
.tiptap .wiki-image-bar button[data-active] {
  background: var(--accent);
  color: var(--foreground);
}
.tiptap .wiki-image-bar form {
  display: flex;
  align-items: center;
  gap: 2px;
}
.tiptap .wiki-image-bar input {
  width: 11rem;
  height: 1.5rem;
  padding: 0 0.375rem;
  font-size: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: var(--background);
  outline: none;
}
```

주의: 기존 `.tiptap img.wiki-image` 의 `margin: 0.5em 0` 은 `.wiki-image-block`(wrapper)으로 이동했다 — img 에 margin 이 남으면 frame(fit-content)과 어긋나 핸들 위치가 밀린다.

- [ ] **Step 3: 검증(타입+린트+테스트)**

Run: `npx tsc --noEmit && npx eslint src/components/wiki src/app/globals.css --no-warn-ignored 2>/dev/null || npx eslint src/components/wiki && npm run test`
Expected: 전부 통과. (`globals.css` 는 eslint 대상 아님 — 무시돼도 정상)

- [ ] **Step 4: 커밋**

```bash
git add src/components/wiki/extensions.ts src/app/globals.css
git commit -m "feat(wiki): 이미지 NodeView 배선 및 스타일 - 핸들/정렬/오버레이 바/라이트박스

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 문서 갱신

**Files:**
- Modify: `docs/work-log.md` (최신 항목 추가 — 파일 상단 형식 확인 후 동일 형식)
- Modify: `CLAUDE.md` (위키 리치 렌더링 불릿에 이미지 서브불릿 추가)

- [ ] **Step 1: work-log 항목 추가**

`docs/work-log.md` 기존 항목 형식에 맞춰(날짜 2026-07-19) 추가:

```markdown
## 2026-07-19 위키 이미지 관리 강화

- 무엇: 본문 이미지 리사이즈(드래그 핸들, px, 최소 80px)·정렬(왼쪽/가운데/오른쪽)·alt 편집(편집 모드), 더블클릭 라이트박스+원본 열기/다운로드(뷰 모드).
- 어떻게: `image-view.tsx` — `Image.extend`(align attr 추가, width 는 순정 attr 정규화) + React NodeView 하나로 편집/뷰 모두 담당. `extensions.ts` 의 `Image.configure` 를 `WikiImage.configure` 로 교체. 순수 로직은 `image-utils.ts`(+vitest).
- 왜 NodeView: 에디터/뷰/공지/댓글이 wikiExtensions 를 공유하므로 한 곳 수정으로 전 표면 반영. 내장 resize 옵션(v3.27)은 DOM NodeView 라 정렬/alt/라이트박스를 못 담아 채택 안 함.
- 스펙: `docs/superpowers/specs/2026-07-19-wiki-image-management-design.md`
```

(실제 파일의 헤딩 레벨·불릿 스타일에 맞춰 조정)

- [ ] **Step 2: CLAUDE.md 위키 리치 렌더링 불릿에 서브불릿 추가**

`- **위키 리치 렌더링**: ...` 섹션의 서브불릿 목록(슬래시 커맨드 항목 앞이나 뒤)에 추가:

```markdown
  - **이미지**(`image-view.tsx` NodeView + `image-utils.ts`): 편집 모드 선택 시 좌우 드래그 핸들 리사이즈(px, `attrs.width`, 최소 80px)·정렬 3버튼(`attrs.align`, 블록 정렬)·ALT 인라인 입력, 뷰 모드 더블클릭 라이트박스(원본 열기/다운로드). 노드 이름은 `image` 유지(기존 문서 호환), width 는 `<img width>` 로 직렬화.
```

- [ ] **Step 3: 커밋**

```bash
git add docs/work-log.md CLAUDE.md docs/superpowers/specs/2026-07-19-wiki-image-management-design.md docs/superpowers/plans/2026-07-19-wiki-image-controls.md
git commit -m "docs: 위키 이미지 관리 강화 스펙/계획/work-log/CLAUDE.md 갱신

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 최종 검증

**Files:** 없음

- [ ] **Step 1: 전체 테스트/타입/린트**

Run: `npm run test && npx tsc --noEmit && npx eslint src`
Expected: 전부 통과.

- [ ] **Step 2: 수동 QA 체크리스트 (dev 서버)**

`npm run dev` 후 위키 페이지에서:

1. 편집: 이미지 클릭 선택 → 좌우 핸들 표시, 드래그로 축소/확대(80px 미만·본문 폭 초과 불가), 놓으면 1회 undo 로 되돌려짐.
2. 편집: 정렬 3버튼 동작(가운데/오른쪽), 원본 크기 버튼은 width 있을 때만 표시.
3. 편집: ALT → 인라인 입력, Enter 저장/Esc 취소.
4. 저장 → 뷰: 크기/정렬 유지, 이미지에 zoom-in 커서, 더블클릭 → 라이트박스(ESC·배경 클릭 닫기, 원본/다운로드 동작).
5. 회귀: 기존 이미지(width/align 없음) 렌더 동일, 이미지 드래그 이동·삭제 정상, 버전 미리보기/공지/댓글 뷰 정상.

주의(gotchas): dev 서버가 이미 떠 있으면 스키마 변경이 아니므로 재시작 불필요. 수동 QA 는 사용자가 확인해도 된다 — 결과 보고에 체크리스트를 남긴다.

---

## Self-Review 기록

- 스펙 커버리지: 리사이즈(T2·T3), 라이트박스+원본/다운로드(T3), 정렬(T3·T4), alt(T3), CSS(T4), 테스트(T2), 문서(T5) — 스펙의 "범위 밖" 항목은 계획에 없음(의도).
- 플레이스홀더: 없음(모든 코드 스텝에 전체 코드 포함).
- 타입 일관성: `resizeWidth`/`parseWidthAttr`/`normalizeAlign`/`IMAGE_MIN_WIDTH`/`ImageAlign` 명칭이 T2 정의와 T3 사용처에서 일치. `WikiImage` 명칭이 T3 정의·T4 배선에서 일치.
