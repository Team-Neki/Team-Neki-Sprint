"use client";

import { useEffect, useRef, useState } from "react";
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
  getBellNotifications,
} from "@/server/actions/notifications";
import {
  notificationHref,
  notificationActor,
  type NotifItem,
} from "@/components/app-shell/notification-shared";
import { cn } from "@/lib/utils";

const POLL_MS = 45_000;

export function NotificationBell({
  items,
  unread,
}: {
  items: NotifItem[];
  unread: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // props를 초기값으로 seed. 이후 폴링/이벤트에서만 갱신(setState-in-effect 금지).
  const [localItems, setLocalItems] = useState<NotifItem[]>(items);
  const [localUnread, setLocalUnread] = useState<number>(unread);

  // 최신 fetch만 반영하도록 순번을 매겨 out-of-order 응답을 무시한다.
  const reqSeq = useRef(0);

  async function refresh() {
    const seq = ++reqSeq.current;
    try {
      const next = await getBellNotifications();
      if (seq !== reqSeq.current) return; // 더 최신 요청이 있으면 폐기
      setLocalItems(next.items);
      setLocalUnread(next.unread);
    } catch {
      // 폴링 실패는 조용히 무시(다음 tick에서 재시도)
    }
  }

  // ~45초 주기 폴링. 언마운트 시 인터벌 정리.
  useEffect(() => {
    const id = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => clearInterval(id);
    // refresh는 setState/ref/안정 import만 참조하므로 마운트당 1회 설정으로 충분.
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    // 팝오버를 열 때 즉시 최신화.
    if (next) void refresh();
  }

  async function openItem(n: NotifItem) {
    setOpen(false);
    if (!n.read) {
      // 낙관적 업데이트: 로컬 읽음 처리 + 미읽음 수 감소.
      setLocalItems((prev) =>
        prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)),
      );
      setLocalUnread((prev) => Math.max(0, prev - 1));
      await markNotificationRead(n.id);
    }
    router.push(notificationHref(n));
    router.refresh();
  }

  async function markAll() {
    // 낙관적 업데이트: 전부 읽음 처리 + 미읽음 0.
    setLocalItems((prev) => prev.map((it) => ({ ...it, read: true })));
    setLocalUnread(0);
    await markAllNotificationsRead();
    router.refresh();
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
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
        {localUnread > 0 && (
          <span className="bg-destructive absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold text-white">
            {localUnread > 9 ? "9+" : localUnread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">알림</span>
          {localUnread > 0 && (
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
          {localItems.length === 0 ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              새 알림이 없어요
            </p>
          ) : (
            localItems.map((n) => (
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
