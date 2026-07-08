"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  getNotifications,
  getUnreadNotificationCount,
} from "@/server/queries";
import {
  toNotifItem,
  type NotifItem,
} from "@/components/app-shell/notification-shared";

/**
 * 알림 벨 폴링용. 현재 유저의 최근 알림 + 미읽음 수를 반환한다.
 * 레이아웃이 넘기는 것과 동일한 NotifItem 형태로 직렬화(createdAt은 ISO 문자열)
 * 하여 클라이언트가 seamless 하게 교체할 수 있게 한다.
 */
export async function getBellNotifications(): Promise<{
  items: NotifItem[];
  unread: number;
}> {
  const user = await requireUser();
  const [notifs, unread] = await Promise.all([
    getNotifications(user.id, 10),
    getUnreadNotificationCount(user.id),
  ]);
  return { items: notifs.map(toNotifItem), unread };
}

/** 단일 알림 읽음 처리. 본인 알림만(다른 유저 알림 변조 방지). */
export async function markNotificationRead(id: string) {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });
  revalidatePath("/notifications");
}

/** 본인의 모든 미읽음 알림 읽음 처리. */
export async function markAllNotificationsRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
}
