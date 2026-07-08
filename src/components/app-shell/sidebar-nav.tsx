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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 px-3 py-4">
      {NAV.map((section) => (
        <div key={section.group} className="flex flex-col gap-1">
          <p className="text-muted-foreground/70 px-3 pb-1 text-[11px] font-medium tracking-wide uppercase">
            {section.group}
          </p>
          {section.items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
