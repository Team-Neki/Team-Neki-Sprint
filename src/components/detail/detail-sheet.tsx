"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { InSheetProvider } from "@/components/detail/in-sheet-context";

/**
 * 목록에서 key/열기 클릭 시 intercepting route 가 이 시트로 상세 페이지를 감싸
 * 우측에서 슬라이드로 띄운다(z-50 포털 → 좌측 사이드바 위). 닫으면 router.back 으로
 * 목록 URL 로 복귀(인터셉트 해제). 새 창 열기 버튼은 전체 상세 페이지를 새 탭으로 연다.
 *
 * 우상단 크롬 액션 행: [삭제 슬롯] [새 창 열기], 그리고 닫기 버튼은 SheetContent
 * 기본 버튼(right-3). 상세 본문 루트가 `@container/detail`(=abs 컨테이닝 블록)이라
 * 본문 안 삭제 버튼을 이 행에 직접 맞출 수 없어, 슬롯 노드를 context 로 내려 상세
 * 페이지의 SheetDeleteButton 이 이 슬롯으로 포털해 세 버튼을 한 줄로 정렬시킨다.
 */
export function DetailSheet({
  fullHref,
  children,
}: {
  fullHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [deleteSlot, setDeleteSlot] = useState<HTMLElement | null>(null);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <SheetContent
        side="right"
        className="z-[60] w-full gap-0 overflow-y-auto p-6 sm:!max-w-xl [&>div]:mx-0 [&>div]:w-full [&>div]:max-w-none"
      >
        <SheetTitle className="sr-only">상세 보기</SheetTitle>
        {/*
          크롬 액션은 각각 절대배치한다(래핑 div 로 묶지 않는다). SheetContent 의
          `[&>div]:w-full` 은 본문 루트 div 폭 보정용인데, 크롬을 div 로 감싸면
          그 셀렉터에 걸려 w-full 이 돼 내용이 화면 밖으로 밀린다. span/<a> 는
          div 가 아니라 안전. 우에서 좌 순서: 닫기(right-3, 기본) · 새 창(right-11) · 삭제(right-20).
        */}
        <span
          ref={setDeleteSlot}
          className="absolute top-3 right-20 z-10 flex items-center"
        />
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
        <InSheetProvider slot={deleteSlot}>{children}</InSheetProvider>
      </SheetContent>
    </Sheet>
  );
}
