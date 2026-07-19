// 알림 벨(드롭다운)과 /notifications 목록이 공유하는 타입·헬퍼(B5).

export type NotifItem = {
  id: string;
  read: boolean;
  type: string;
  entityType: string;
  entityId: string;
  context: string | null;
  createdAt: string; // ISO (서버→클라이언트 직렬화)
  actor: { id: string; name: string | null; email: string } | null;
};

/** 알림 대상(entityType/entityId)으로 이동할 경로. */
export function notificationHref(n: NotifItem) {
  switch (n.entityType) {
    case "wiki":
      return `/wiki/${n.entityId}`;
    case "task":
      return `/tasks/${n.entityId}`;
    case "epic":
      return `/epics/${n.entityId}`;
    case "project":
      return `/projects/${n.entityId}`;
    case "sprint":
      return `/sprints/${n.entityId}`;
    case "announcement":
      return `/announcements/${n.entityId}`;
    default:
      return "/notifications";
  }
}

export function notificationActor(n: NotifItem) {
  return n.actor?.name ?? n.actor?.email ?? "누군가";
}

/** 서버 쿼리 결과(getNotifications 항목)를 클라이언트 직렬화 형태로 변환. */
export function toNotifItem(n: {
  id: string;
  read: boolean;
  type: string;
  entityType: string;
  entityId: string;
  context: string | null;
  createdAt: Date;
  actor: { id: string; name: string | null; email: string } | null;
}): NotifItem {
  return {
    id: n.id,
    read: n.read,
    type: n.type,
    entityType: n.entityType,
    entityId: n.entityId,
    context: n.context,
    createdAt: n.createdAt.toISOString(),
    actor: n.actor
      ? { id: n.actor.id, name: n.actor.name, email: n.actor.email }
      : null,
  };
}
