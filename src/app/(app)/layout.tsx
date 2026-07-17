import { requireUser } from "@/lib/session";
import { signOut } from "@/auth";
import {
  getNotifications,
  getUnreadNotificationCount,
} from "@/server/queries";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { NotificationBell } from "@/components/app-shell/notification-bell";
import { CommandPalette } from "@/components/app-shell/command-palette";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import {
  SidebarProvider,
  DesktopSidebar,
  SidebarToggle,
  SidebarBrand,
} from "@/components/app-shell/sidebar-collapse";
import { toNotifItem } from "@/components/app-shell/notification-shared";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const [notifs, unread] = await Promise.all([
    getNotifications(user.id, 10),
    getUnreadNotificationCount(user.id),
  ]);
  const notifItems = notifs.map(toNotifItem);

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <SidebarProvider>
      <div className="flex h-dvh overflow-hidden">
        {/* Desktop sidebar (접기 가능 — 접히면 아이콘 레일) */}
        <DesktopSidebar brand={<SidebarBrand />}>
          <SidebarNav />
        </DesktopSidebar>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
            {/* Desktop sidebar toggle */}
            <SidebarToggle />
            {/* Mobile menu (경로 변경 시 자동 닫힘 — MobileNav 내부에서 처리) */}
            <MobileNav />

            <div className="flex-1" />

          <CommandPalette />

          <NotificationBell items={notifItems} unread={unread} />

          <UserMenu
            id={user.id}
            name={user.name ?? user.email ?? "사용자"}
            email={user.email ?? ""}
            image={user.image}
            onSignOut={handleSignOut}
          />
        </header>

        {/* scrollbar-gutter:stable → 스크롤바 폭을 항상 예약해, 상세 시트(모달)
            열릴 때 스크롤 락으로 스크롤바가 사라져도 콘텐츠가 좌우로 밀리지 않게 한다. */}
        <main className="flex-1 overflow-y-auto p-4 pb-12 [scrollbar-gutter:stable] sm:p-6 sm:pb-12">
          {children}
        </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
