import Link from "next/link";
import { Menu } from "lucide-react";
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
import { toNotifItem } from "@/components/app-shell/notification-shared";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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

  const brand = (
    <Link href="/dashboard" className="flex items-center gap-2 px-5 py-4">
      <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg text-sm font-bold">
        S
      </span>
      <span className="text-base font-semibold tracking-tight">Sprint</span>
    </Link>
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="bg-background hidden w-60 shrink-0 border-r md:flex md:flex-col">
        {brand}
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger
              render={<Button variant="ghost" size="icon" className="md:hidden" />}
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">메뉴</SheetTitle>
              {brand}
              <SidebarNav />
            </SheetContent>
          </Sheet>

          <div className="flex-1" />

          <CommandPalette />

          <NotificationBell items={notifItems} unread={unread} />

          <UserMenu
            name={user.name ?? user.email ?? "사용자"}
            email={user.email ?? ""}
            image={user.image}
            onSignOut={handleSignOut}
          />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
