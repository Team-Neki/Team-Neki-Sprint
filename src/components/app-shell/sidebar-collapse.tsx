"use client";

import { createContext, useContext, useState } from "react";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 좌측 메인 사이드바(앱 네비) 접기/펼치기. 레이아웃이 서버 컴포넌트라, 접힘 상태를
 * client 컨텍스트로 공유한다 — 헤더의 토글 버튼과 사이드바가 형제라 상태 공유가 필요.
 * (app) 레이아웃은 소프트 내비게이션에서 remount 되지 않으므로 세션 내 상태가 유지된다.
 */
const SidebarContext = createContext<{
  collapsed: boolean;
  toggle: () => void;
} | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SidebarContext.Provider
      value={{ collapsed, toggle: () => setCollapsed((c) => !c) }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

/** 데스크톱 사이드바(md+). 접히면 폭 0 으로 슬라이드(내용은 overflow-hidden 으로 클립). */
export function DesktopSidebar({
  brand,
  children,
}: {
  brand: React.ReactNode;
  children: React.ReactNode;
}) {
  const { collapsed } = useSidebar();
  return (
    <aside
      className={cn(
        "bg-background hidden shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 md:flex",
        collapsed ? "w-0 border-r-0" : "w-60",
      )}
    >
      {brand}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

/** 헤더의 데스크톱 사이드바 토글 버튼(md+). 모바일은 별도 Sheet 햄버거 사용. */
export function SidebarToggle() {
  const { collapsed, toggle } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="hidden md:inline-flex"
      onClick={toggle}
      aria-label={collapsed ? "사이드바 열기" : "사이드바 접기"}
    >
      <PanelLeft className="size-5" />
    </Button>
  );
}
