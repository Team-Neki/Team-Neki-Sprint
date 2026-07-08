import { requireUser } from "@/lib/session";
import { getNotifications } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { NotificationList } from "@/components/app-shell/notification-list";
import { toNotifItem } from "@/components/app-shell/notification-shared";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();
  const raw = await getNotifications(user.id, 50);
  const items = raw.map(toNotifItem);

  return (
    <div>
      <PageHeader title="알림" description="나를 언급한 알림을 확인하세요." />
      <div className="mx-auto max-w-3xl">
        <NotificationList items={items} />
      </div>
    </div>
  );
}
