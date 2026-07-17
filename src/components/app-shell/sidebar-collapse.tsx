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
  width: number;
  setWidth: (w: number) => void;
} | null>(null);

// 펼친 사이드바 폭(px). 기본 240(=w-60=15rem). 드래그 리사이즈로 [MIN,MAX] 안에서 조절.
const DEFAULT_W = 240;
const MIN_W = 200;
const MAX_W = 400;
const STORAGE_KEY = "app:sidebarW";

function clampW(w: number) {
  return Math.min(MAX_W, Math.max(MIN_W, w));
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  // localStorage 초기화는 SSR 하이드레이션 안전을 위해 window 존재 시에만. 잘못된 값은 기본으로.
  const [width, setWidthState] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_W;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? clampW(n) : DEFAULT_W;
  });

  const setWidth = (w: number) => {
    const next = clampW(w);
    setWidthState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    }
  };

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        toggle: () => setCollapsed((c) => !c),
        width,
        setWidth,
      }}
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
  const { collapsed, width, setWidth } = useSidebar();

  // 우측 엣지 드래그 리사이즈 — epic-timeline 의 onResizeStart 패턴 재사용.
  // pointerdown 에서 startX+startWidth 캡처, window pointermove 로 [MIN,MAX] 클램프,
  // pointerup 에서 리스너 해제. 접힘(레일) 상태에선 핸들을 숨겨 호출되지 않는다.
  function onResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: PointerEvent) => {
      setWidth(startW + (ev.clientX - startX));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <aside
      className={cn(
        "bg-background relative hidden shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 md:flex",
        collapsed && "w-14",
      )}
      // 펼친 상태에서만 인라인 폭을 적용(접히면 w-14 레일 클래스 사용).
      style={collapsed ? undefined : { width }}
    >
      {brand}
      <div className="flex-1 overflow-y-auto">{children}</div>
      {/* 우측 엣지 드래그 핸들(펼친 상태 전용). 얇은 세로 바 + hover 하이라이트
          (epic-timeline 거터 핸들과 동일 톤). 접힘(레일)일 땐 렌더 안 함. */}
      {!collapsed && (
        <div
          onPointerDown={onResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="사이드바 너비 조절"
          className="hover:bg-link/30 absolute inset-y-0 -right-0.5 z-40 w-1.5 cursor-col-resize"
        />
      )}
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
