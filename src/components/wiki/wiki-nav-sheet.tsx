"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * 모바일(<md) 전용 위키 탐색 드로어. 데스크톱 좌측 사이드바(즐겨찾기·페이지 트리·휴지통)가
 * `hidden md:block` 이라 모바일에선 사라지므로, 같은 내용을 Sheet 로 열어 문서 탐색을 가능하게 한다.
 * 페이지 이동(경로 변경) 시 자동으로 닫아 콘텐츠를 가리지 않는다.
 */
export function WikiNavSheet({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [prevPath, setPrevPath] = useState(pathname);

  // 링크로 다른 문서로 이동하면(경로 변경) 드로어를 닫는다(모바일에서 콘텐츠 가림 방지).
  // effect/ref 대신 이전 값을 state 로 두는 'render 중 조건부 setState'(derive during
  // render) — react-hooks set-state-in-effect·refs 규칙 회피(칸반/상세 선례와 동일).
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    if (open) setOpen(false);
  }

  return (
    <div className="mb-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" size="sm" />}>
          <PanelLeft className="size-4" /> 문서 트리
        </SheetTrigger>
        <SheetContent side="left" className="w-72 overflow-y-auto p-4">
          <SheetTitle className="sr-only">위키 탐색</SheetTitle>
          <div className="space-y-4">{children}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
