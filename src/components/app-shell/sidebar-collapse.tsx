"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SprintMark } from "@/components/logo";
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

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

/**
 * 데스크톱 사이드바(md+). 접히면 폭 0 대신 아이콘 레일(w-14)로 줄여, 접은 상태에서도
 * 아이콘 + 툴팁으로 내비게이션이 유지된다(SidebarNav 가 collapsed 컨텍스트를 읽어
 * 아이콘 전용으로 렌더). 내용은 overflow-hidden 으로 클립.
 */
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
        collapsed ? "w-14" : "w-60",
      )}
    >
      {brand}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

/**
 * 브랜드 로고/워드마크. 접히면(collapsed) 로고만 중앙정렬(레일 폭에 맞춤).
 * 모바일 Sheet 는 alwaysExpanded 로 항상 풀 브랜드.
 */
export function SidebarBrand({
  alwaysExpanded = false,
}: {
  alwaysExpanded?: boolean;
}) {
  const { collapsed } = useSidebar();
  const isCollapsed = !alwaysExpanded && collapsed;
  return (
    <Link
      href="/dashboard"
      className={cn(
        "flex items-center py-4",
        isCollapsed ? "justify-center px-2" : "gap-2 px-5",
      )}
      aria-label="Sprint 대시보드"
    >
      <SprintMark />
      {!isCollapsed && (
        <span className="text-base font-semibold tracking-tight">Sprint</span>
      )}
    </Link>
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
