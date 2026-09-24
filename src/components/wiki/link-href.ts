/**
 * 사용자가 입력한 링크 문자열을 href 로 정규화한다.
 * - 스킴이 없으면(example.com) https:// 를 붙인다.
 * - 앵커(#)·절대/상대 경로(/)·프로토콜 상대(//)·mailto:/tel: 등 스킴 있는 값은 그대로.
 * - 빈 값, javascript:/data:/vbscript: 는 null(링크 미적용).
 */
const DANGEROUS = /^(javascript|data|vbscript):/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeHref(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (DANGEROUS.test(v)) return null;
  if (v.startsWith("#") || v.startsWith("/")) return v;
  if (HAS_SCHEME.test(v)) return v;
  return `https://${v}`;
}
