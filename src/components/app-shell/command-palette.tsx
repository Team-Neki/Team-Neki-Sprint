"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ListTodo,
  Layers,
  FolderKanban,
  FileText,
  User,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { globalSearchAction } from "@/server/actions/search";
import type { GlobalSearchItem, GlobalSearchResult } from "@/server/queries";
import { cn } from "@/lib/utils";

type GroupKey = keyof GlobalSearchResult;

const GROUPS: { key: GroupKey; label: string; icon: LucideIcon }[] = [
  { key: "tasks", label: "태스크", icon: ListTodo },
  { key: "epics", label: "에픽", icon: Layers },
  { key: "projects", label: "프로젝트", icon: FolderKanban },
  { key: "wiki", label: "위키", icon: FileText },
  { key: "users", label: "사용자", icon: User },
];

const EMPTY: GlobalSearchResult = {
  tasks: [],
  epics: [],
  projects: [],
  wiki: [],
  users: [],
};

/** 이 길이 미만이면 검색하지 않고 힌트를 보여준다. */
const MIN_QUERY = 2;
const DEBOUNCE_MS = 200;

/**
 * 전역 검색 / 커맨드 팔레트(C7). ⌘K·Ctrl+K(전역 keydown) 또는 토바 트리거로 열고,
 * 디바운스 입력을 서버 액션(globalSearchAction)에 넘겨 그룹 결과를 보여준다.
 * ↑/↓ 로 항목 이동, Enter 로 router.push, Esc(Base UI Dialog 기본)로 닫기.
 * 커맨드 팔레트는 plain React + Base UI Dialog 로만 구현(cmdk 등 외부 의존 없음).
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{
    q: string;
    data: GlobalSearchResult;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // 전역 ⌘K / Ctrl+K 토글. 트리거에 포커스가 없어도 동작한다.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const trimmed = query.trim();

  // 디바운스 검색. 주의: setState 는 effect 본문이 아니라 지연/비동기 콜백에서만
  // 호출한다(react-hooks/set-state-in-effect 회피).
  useEffect(() => {
    if (!open || trimmed.length < MIN_QUERY) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      globalSearchAction(trimmed)
        .then((data) => {
          if (!cancelled) setResult({ q: trimmed, data });
        })
        .catch(() => {
          if (!cancelled) setResult({ q: trimmed, data: EMPTY });
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, open]);

  // 파생값(렌더 중 계산 — 별도 state·effect 불필요). 결과는 그 결과를 만든
  // 질의와 현재 질의가 일치할 때만 보여준다(디바운스 중 stale 표시 방지).
  const showResults =
    !!result && result.q === trimmed && trimmed.length >= MIN_QUERY;
  const groups = showResults ? result.data : EMPTY;

  const flat: { item: GlobalSearchItem; group: GroupKey }[] = [];
  for (const g of GROUPS) {
    for (const item of groups[g.key]) flat.push({ item, group: g.key });
  }
  const total = flat.length;
  const active = total > 0 ? Math.min(activeIndex, total - 1) : 0;

  // 활성 항목을 뷰포트 안으로. side-effect(스크롤)만, setState 없음.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, showResults]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResult(null);
      setActiveIndex(0);
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (total === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (Math.min(i, total - 1) + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (Math.min(i, total - 1) - 1 + total) % total);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = flat[active];
      if (sel) go(sel.item.href);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="검색 (Command K)"
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-9 items-center gap-2 rounded-lg border bg-muted/40 px-2.5 text-sm transition-colors"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden sm:inline">검색</span>
        <kbd className="bg-background text-muted-foreground ml-1 hidden rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none sm:inline">
          ⌘K
        </kbd>
      </button>

      {/*
        팔레트는 중앙이 아니라 상단 15dvh 에 고정한다. 따라서 높이 상한도 "그 아래 남은
        공간"(85dvh)이어야 한다 — DialogContent 기본값 `max-h-[calc(100dvh-2rem)]` 은 이
        오프셋을 모르기 때문에, 짧은 뷰포트(가로모드 폰 등)에서 팔레트 하단이 화면 밖으로
        잘렸다(높이 386px 에서 25px 잘림 실측). `vh` → `dvh` 는 모바일 주소창 높이 변화 대응.
        overflow 는 x 만 hidden — y 까지 막으면 아주 짧은 뷰포트에서 내용에 닿을 수 없어,
        기본값 `overflow-y-auto` 를 살려 스크롤로 degrade 시킨다. [gotchas §35]
      */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="top-[15dvh] max-h-[calc(85dvh-1rem)] translate-y-0 gap-0 overflow-x-hidden p-0 sm:max-w-lg"
        >
          <DialogTitle className="sr-only">전역 검색</DialogTitle>
          <DialogDescription className="sr-only">
            태스크, 에픽, 프로젝트, 위키, 사용자를 검색합니다.
          </DialogDescription>

          <div className="flex items-center gap-2 border-b px-3">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="태스크, 에픽, 프로젝트, 위키, 사용자 검색…"
              className="placeholder:text-muted-foreground h-11 w-full bg-transparent text-sm outline-none"
              aria-label="검색어"
            />
          </div>

          <div ref={listRef} className="max-h-80 overflow-y-auto p-1">
            {trimmed.length < MIN_QUERY ? (
              <p className="text-muted-foreground px-2 py-8 text-center text-sm">
                두 글자 이상 입력해 검색하세요.
              </p>
            ) : loading && !showResults ? (
              <p className="text-muted-foreground px-2 py-8 text-center text-sm">
                검색 중…
              </p>
            ) : total === 0 ? (
              <p className="text-muted-foreground px-2 py-8 text-center text-sm">
                &ldquo;{trimmed}&rdquo; 에 대한 결과가 없습니다.
              </p>
            ) : (
              (() => {
                let idx = -1;
                return GROUPS.map((g) => {
                  const items = groups[g.key];
                  if (items.length === 0) return null;
                  const Icon = g.icon;
                  return (
                    <div key={g.key} className="mb-1 last:mb-0">
                      <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                        {g.label}
                      </div>
                      {items.map((item) => {
                        idx += 1;
                        const myIndex = idx;
                        const isActive = myIndex === active;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            data-active={isActive}
                            onClick={() => go(item.href)}
                            onMouseMove={() => setActiveIndex(myIndex)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                              isActive
                                ? "bg-muted text-foreground"
                                : "text-foreground/90 hover:bg-muted/60",
                            )}
                          >
                            <Icon className="text-muted-foreground size-4 shrink-0" />
                            {item.key && (
                              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                                {item.key}
                              </span>
                            )}
                            <span className="min-w-0 flex-1 truncate">
                              {item.title}
                            </span>
                            {item.subtitle && (
                              <span className="text-muted-foreground max-w-[40%] shrink-0 truncate text-xs">
                                {item.subtitle}
                              </span>
                            )}
                            {isActive && (
                              <CornerDownLeft className="text-muted-foreground size-3.5 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                });
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
