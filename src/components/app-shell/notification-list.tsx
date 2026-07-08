"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Card } from "@/components/ui/card";
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

export function NotificationList({ items }: { items: NotifItem[] }) {
  const router = useRouter();
  const unread = items.filter((n) => !n.read).length;

  async function openItem(n: NotifItem) {
    if (!n.read) await markNotificationRead(n.id);
    router.push(notificationHref(n));
    router.refresh();
  }

  async function markAll() {
    await markAllNotificationsRead();
    router.refresh();
  }

  return (
    <div>
      {unread > 0 && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={markAll}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            모두 읽음
          </button>
        </div>
      )}
      {items.length === 0 ? (
        <Card className="text-muted-foreground py-16 text-center text-sm">
          새 알림이 없어요
        </Card>
      ) : (
        <Card className="gap-0 divide-y p-0">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => openItem(n)}
              className={cn(
                "hover:bg-accent flex w-full items-start gap-3 px-4 py-3 text-left",
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
                  <span className="text-muted-foreground block truncate text-sm">
                    {n.context}
                  </span>
                )}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {formatDistanceToNow(new Date(n.createdAt), {
                  addSuffix: true,
                  locale: ko,
                })}
              </span>
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
