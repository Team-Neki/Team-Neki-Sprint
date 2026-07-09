"use client";

import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { InSheetProvider } from "@/components/detail/in-sheet-context";

/**
 * 목록에서 key/열기 클릭 시 intercepting route 가 이 시트로 상세 페이지를 감싸
 * 우측에서 슬라이드로 띄운다(z-50 포털 → 좌측 사이드바 위). 닫으면 router.back 으로
 * 목록 URL 로 복귀(인터셉트 해제). ↗ 버튼은 전체 상세 페이지를 새 탭으로 연다.
 */
export function DetailSheet({
  fullHref,
  children,
}: {
  fullHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <SheetContent
        side="right"
        className="z-[60] w-full gap-0 overflow-y-auto p-6 sm:!max-w-3xl"
      >
        <SheetTitle className="sr-only">상세 보기</SheetTitle>
        <a
          href={fullHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="새 창에서 상세 열기"
          title="새 창에서 열기"
          className="text-muted-foreground hover:text-foreground hover:bg-accent absolute top-3 right-11 z-10 inline-flex size-8 items-center justify-center rounded-md transition-colors"
        >
          <ArrowUpRight className="size-4" />
        </a>
        <InSheetProvider>{children}</InSheetProvider>
      </SheetContent>
    </Sheet>
  );
}
