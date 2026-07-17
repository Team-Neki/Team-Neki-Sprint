"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarBrand } from "@/components/app-shell/sidebar-collapse";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";

/**
 * 모바일(<md) 전용 전역 내비 드로어. 데스크톱 사이드바(md:flex)가 모바일에선 사라지므로
 * 헤더의 햄버거로 같은 브랜드/내비를 Sheet 로 연다. 페이지 이동(경로 변경) 시 자동으로
 * 닫아 콘텐츠를 가리지 않는다(레이아웃의 인라인 uncontrolled Sheet 를 대체).
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [prevPath, setPrevPath] = useState(pathname);

  // 링크로 이동하면(경로 변경) 드로어를 닫는다(모바일에서 콘텐츠 가림 방지).
  // effect/ref 대신 이전 값을 state 로 두는 'render 중 조건부 setState'(derive during
  // render) — wiki-nav-sheet 와 동일 패턴.
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    if (open) setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="메뉴 열기"
            className="md:hidden"
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">메뉴</SheetTitle>
        <SidebarBrand alwaysExpanded />
        <SidebarNav alwaysExpanded />
      </SheetContent>
    </Sheet>
  );
}
