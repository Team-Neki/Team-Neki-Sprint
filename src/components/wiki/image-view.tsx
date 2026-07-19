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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
            {/* 좌상단 오버레이 컨트롤(code-block 복사 버튼 패턴). 아이콘 버튼 툴팁은
                에디터 툴바(Btn)와 동일하게 Base UI Tooltip(≈150ms) — 네이티브 title 아님. */}
            <TooltipProvider delay={150}>
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
                      <Tooltip key={value}>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              aria-label={label}
                              data-active={align === value ? "" : undefined}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => updateAttributes({ align: value })}
                            >
                              <Icon className="size-3.5" />
                            </button>
                          }
                        />
                        <TooltipContent>{label}</TooltipContent>
                      </Tooltip>
                    ))}
                    {width != null && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              aria-label="원본 크기"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => updateAttributes({ width: null })}
                            >
                              <RotateCcw className="size-3.5" />
                            </button>
                          }
                        />
                        <TooltipContent>원본 크기</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            aria-label="대체 텍스트 편집"
                            data-active={alt ? "" : undefined}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={openAlt}
                          >
                            ALT
                          </button>
                        }
                      />
                      <TooltipContent>대체 텍스트</TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            </TooltipProvider>
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
 * 뷰 모드 더블클릭 확대 오버레이. 네이티브 <dialog>.showModal() 로 포커스
 * 트래핑·ESC 닫기를 내장 동작으로 얻는다(ESC 는 cancel→close 이벤트로 onClose 전파).
 * body 포털은 유지 — .tiptap 하위에 두면 에디터 CSS(.tiptap img 등)가 라이트박스에
 * 새어 들어온다. 배경 클릭 닫기, 열려 있는 동안 body 스크롤 잠금, 원본 새 탭
 * 열기/다운로드 액션 포함(same-origin URL).
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      if (dialog.open) dialog.close();
    };
  }, []);

  const chip =
    "flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20";

  // 렌더 중 document 접근 가드 — 서버 렌더에선 브라우저 전역이 없다.
  // (실제로는 뷰 모드 더블클릭 후에만 마운트되지만, 클라이언트 전용 경로를 명시한다.)
  if (typeof document === "undefined") return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-black/80 p-6 outline-none backdrop:bg-transparent open:flex"
      aria-label={alt || "이미지 확대 보기"}
      onClose={onClose}
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
    </dialog>,
    document.body,
  );
}
