"use client";

import { useState } from "react";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// 사이드바 폭(px) — 드래그로 리사이즈 가능. 기본/최소/최대.
const SIDEBAR_W = 256;
const SIDEBAR_W_MIN = 200;
const SIDEBAR_W_MAX = 480;

const COLLAPSED_STORAGE_KEY = "wiki:sidebar";
const WIDTH_STORAGE_KEY = "wiki:sidebarW";

// SSR 에선 localStorage 접근 불가 → initializer 에서 window 존재할 때만 복원한다.
function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function readWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_W;
  try {
    const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
    const n = raw ? Number(raw) : SIDEBAR_W;
    if (!Number.isFinite(n)) return SIDEBAR_W;
    return Math.min(SIDEBAR_W_MAX, Math.max(SIDEBAR_W_MIN, n));
  } catch {
    return SIDEBAR_W;
  }
}

/**
 * 데스크톱(>=md) 전용 위키 좌측 사이드바 셸. 내부 nav(즐겨찾기·페이지 트리·휴지통)를
 * children 으로 받아 aside 로 감싼다. 접힘(토글)과 드래그 리사이즈를 제공하며 두 상태를
 * localStorage 에 보존한다. 모바일(<md)은 이 컴포넌트가 숨겨지고 WikiNavSheet 가 담당한다.
 */
export function WikiSidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [width, setWidth] = useState(readWidth);

  const persistCollapsed = (next: boolean) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // localStorage 쓰기 실패는 무시 — 토글은 메모리로도 동작.
    }
  };

  const toggleCollapsed = () =>
    setCollapsed((prev) => {
      const next = !prev;
      persistCollapsed(next);
      return next;
    });

  // 우측 경계 드래그 리사이즈. 타임라인 onResizeStart 패턴을 그대로 재사용:
  // pointerdown 에서 시작 좌표/폭을 잡고, window pointermove 로 폭을 clamp 하며 갱신,
  // pointerup 에서 리스너 해제 + 최종 폭을 localStorage 에 저장한다.
  function onResizeStart(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: PointerEvent) => {
      const next = startW + (ev.clientX - startX);
      setWidth(Math.min(SIDEBAR_W_MAX, Math.max(SIDEBAR_W_MIN, next)));
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const final = Math.min(
        SIDEBAR_W_MAX,
        Math.max(SIDEBAR_W_MIN, startW + (ev.clientX - startX)),
      );
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(WIDTH_STORAGE_KEY, String(final));
        } catch {
          // 저장 실패는 무시.
        }
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  if (collapsed) {
    // 접힘: 슬림 재열기 버튼만 노출(내용 숨김). hidden md:block 으로 데스크톱 전용 유지.
    return (
      <aside className="hidden shrink-0 md:block">
        <div className="sticky top-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleCollapsed}
            title="사이드바 펼치기"
            aria-label="사이드바 펼치기"
          >
            <PanelLeft className="size-4" />
          </Button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="relative hidden shrink-0 md:block"
      style={{ width }}
    >
      <div className="sticky top-0 max-h-[calc(100dvh-5rem)] space-y-4 overflow-y-auto pr-1">
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleCollapsed}
            title="사이드바 접기"
            aria-label="사이드바 접기"
          >
            <PanelLeft className="size-4" />
          </Button>
        </div>
        {children}
      </div>
      {/* 우측 경계 드래그 핸들 — 타임라인 핸들과 동일 스타일(얇게, col-resize, subtle hover). */}
      <div
        onPointerDown={onResizeStart}
        role="separator"
        aria-orientation="vertical"
        aria-label="사이드바 너비 조절"
        className="hover:bg-link/30 absolute inset-y-0 -right-3 z-10 w-2 cursor-col-resize"
      />
    </aside>
  );
}
