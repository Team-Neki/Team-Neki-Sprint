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
