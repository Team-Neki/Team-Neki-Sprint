"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Rocket,
  Target,
  Layers,
  KanbanSquare,
  ListTodo,
  CalendarRange,
  Users,
  Tag,
  BookText,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/app-shell/sidebar-collapse";

const NAV = [
  { group: "개요", items: [{ href: "/dashboard", label: "대시보드", icon: LayoutDashboard }] },
  {
    group: "작업",
    items: [
      { href: "/sprints", label: "스프린트", icon: Rocket },
      { href: "/projects", label: "프로젝트", icon: Target },
      { href: "/epics", label: "에픽", icon: Layers },
      { href: "/tasks", label: "태스크", icon: ListTodo },
      { href: "/board", label: "보드", icon: KanbanSquare },
      { href: "/timeline", label: "타임라인", icon: CalendarRange },
    ],
  },
  {
    group: "조직",
    items: [
      { href: "/teams", label: "팀", icon: Users },
      { href: "/labels", label: "라벨", icon: Tag },
    ],
  },
  { group: "문서", items: [{ href: "/wiki", label: "위키", icon: BookText }] },
  {
    group: "설정",
    items: [{ href: "/settings/tokens", label: "API 토큰", icon: KeyRound }],
  },
];

/**
 * 좌측 내비. 데스크톱은 접힘 컨텍스트(useSidebar)를 읽어 접히면 아이콘 전용 레일로
 * 렌더한다(그룹 라벨 숨김, 아이콘 중앙정렬, title 툴팁). 모바일 Sheet 는 항상 펼침이
 * 자연스러우므로 alwaysExpanded 로 접힘을 무시한다.
 */
export function SidebarNav({
  alwaysExpanded = false,
}: {
  alwaysExpanded?: boolean;
}) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const isCollapsed = !alwaysExpanded && collapsed;

  return (
    <nav
      className={cn(
        "flex flex-col gap-5 py-4",
        isCollapsed ? "px-2" : "px-3",
      )}
    >
      {NAV.map((section) => (
        <div key={section.group} className="flex flex-col gap-1">
          {!isCollapsed && (
            <p className="text-muted-foreground/70 px-3 pb-1 text-[11px] font-medium tracking-wide uppercase">
              {section.group}
            </p>
          )}
          {section.items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                aria-label={isCollapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center rounded-md text-sm transition-colors",
                  isCollapsed ? "justify-center py-2" : "gap-2.5 px-3 py-2",
                  // DESIGN ex-app-shell-row: 활성 항목은 좌측 엣지 primary 바로 표시.
                  active
                    ? "bg-accent text-accent-foreground font-medium before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!isCollapsed && item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
