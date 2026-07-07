"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * 뒤로가기 버튼(B3 back). 브라우저 히스토리가 있으면 `router.back()`으로 직전 화면
 * (예: 타임라인)으로 돌아가고, 없으면(새 탭·직접 진입) `fallback` 목록으로 이동한다.
 * 상세 페이지의 하드코딩 `<Link href="/epics">` 등을 대체한다.
 */
export function BackButton({
  fallback,
  label,
}: {
  fallback: string;
  label: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
    >
      <ChevronLeft className="size-4" /> {label}
    </button>
  );
}
