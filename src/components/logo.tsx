import { cn } from "@/lib/utils";

/**
 * Sprint 로고 마크. 상승하는 세 막대(진행/스프린트 모티프) — 파비콘(app/icon.svg)과
 * 동일 형태. 앱 셸 브랜드에서 워드마크와 함께 쓴다. 색은 ink 면 + 흰 막대(brand).
 */
export function SprintMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7 shrink-0", className)}
      role="img"
      aria-label="Sprint"
    >
      <rect width="32" height="32" rx="7" fill="var(--primary)" />
      <rect x="8" y="18" width="4" height="6" rx="1.5" fill="var(--primary-foreground)" />
      <rect x="14" y="13" width="4" height="11" rx="1.5" fill="var(--primary-foreground)" />
      <rect x="20" y="8" width="4" height="16" rx="1.5" fill="var(--primary-foreground)" />
    </svg>
  );
}
