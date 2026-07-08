"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/server/actions/notifications";
import {
  notificationHref,
  notificationActor,
  type NotifItem,
} from "@/components/app-shell/notification-shared";
import { cn } from "@/lib/utils";

export function NotificationBell({
  items,
  unread,
}: {
  items: NotifItem[];
  unread: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function openItem(n: NotifItem) {
    setOpen(false);
    if (!n.read) await markNotificationRead(n.id);
    router.push(notificationHref(n));
    router.refresh();
  }

  async function markAll() {
    await markAllNotificationsRead();
    router.refresh();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative size-9"
            aria-label="알림"
          />
        }
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="bg-destructive absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">알림</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAll}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              모두 읽음
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              새 알림이 없어요
            </p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openItem(n)}
                className={cn(
                  "hover:bg-accent flex w-full items-start gap-2 border-b px-3 py-2.5 text-left last:border-b-0",
                  !n.read && "bg-muted/40",
                )}
              >
                {!n.read ? (
                  <span className="bg-link mt-1.5 size-2 shrink-0 rounded-full" />
                ) : (
                  <span className="mt-1.5 size-2 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="text-sm">
                    <span className="font-medium">{notificationActor(n)}</span>
                    님이 회원님을 언급했어요
                  </span>
                  {n.context && (
                    <span className="text-muted-foreground block truncate text-xs">
                      {n.context}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground block border-t px-3 py-2 text-center text-xs"
        >
          모든 알림 보기
        </Link>
      </PopoverContent>
    </Popover>
  );
}
