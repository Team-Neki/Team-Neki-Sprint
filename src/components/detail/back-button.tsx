"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useInSheet } from "@/components/detail/in-sheet-context";

/**
 * 뒤로가기 버튼(B3 back). 라벨이 가리키는 목적지(`fallback`, 예: 에픽 목록)로 이동한다.
 * 과거엔 히스토리가 있으면 `router.back()`(stack pop)으로 직전 화면으로 돌아갔으나,
 * 라벨은 특정 목록("에픽")을 가리키는데 실제로는 직전 화면(타임라인 등)으로 튀어
 * 사용자 기대와 어긋났다(예: 타임라인→에픽 상세에서 "<에픽" 클릭 시 에픽 목록이
 * 아니라 타임라인으로 돌아감). 이제 항상 라벨이 지시하는 목적지로 이동한다.
 * (원래 하드코딩 `<Link href="/epics">` 이던 동작으로 복귀.)
 */
export function BackButton({
  fallback,
  label,
}: {
  fallback: string;
  label: string;
}) {
  const router = useRouter();
  // 우측 슬라이드 상세 안에선 뒤로가기(닫기 X 와 중복·라벨 오해)를 숨긴다.
  const inSheet = useInSheet();
  if (inSheet) return null;
  return (
    <button
      type="button"
      onClick={() => router.push(fallback)}
      className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm"
    >
      <ChevronLeft className="size-4" /> {label}
    </button>
  );
}
