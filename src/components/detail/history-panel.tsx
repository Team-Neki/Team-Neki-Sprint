import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import type { Status } from "@prisma/client";
import { STATUS_META } from "@/lib/constants";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import {
  FIELD_LABEL,
  formatFieldValue,
  buildLookups,
  type Lookups,
  type NamedRef,
} from "@/lib/activity-format";

export type ActivityItem = {
  id: string;
  action: string;
  meta: unknown;
  createdAt: Date | string;
  user: MiniUser | null;
};

function actorName(user: MiniUser | null): string {
  return user?.name ?? user?.email ?? "누군가";
}

/**
 * 업무 히스토리 패널(B8). 엔티티 Activity 를 최신순 한국어 문장으로 렌더한다.
 * field_changed 이벤트는 "X님이 <필드>을(를) A → B 로 변경"으로, 나머지(생성/댓글 등)는
 * 간단한 문장으로 표시. 값 해석(라벨·이름·날짜)은 공용 `activity-format` 을 쓴다.
 */
export function HistoryPanel({
  activities,
  members = [],
  epics = [],
  projects = [],
  sprints = [],
  title = "업무 히스토리",
}: {
  activities: ActivityItem[];
  members?: MiniUser[];
  epics?: NamedRef[];
  projects?: NamedRef[];
  sprints?: NamedRef[];
  title?: string;
}) {
  const lookups = buildLookups({ members, epics, projects, sprints });

  return (
    <div>
      {title ? <h3 className="mb-3 text-sm font-medium">{title}</h3> : null}
      {activities.length === 0 ? (
        <p className="text-muted-foreground text-sm">변경 이력이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {activities.map((a) => (
            <li key={a.id} className="flex gap-2.5 text-sm">
              <UserBadge user={a.user} hideName size="xs" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground leading-snug">
                  <Sentence activity={a} lookups={lookups} />
                </p>
                <span className="text-muted-foreground/70 text-xs">
                  {formatDistanceToNow(new Date(a.createdAt), {
                    addSuffix: true,
                    locale: ko,
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Sentence({
  activity,
  lookups,
}: {
  activity: ActivityItem;
  lookups: Lookups;
}) {
  const actor = actorName(activity.user);
  const actorEl = <span className="text-foreground font-medium">{actor}</span>;
  const meta =
    activity.meta && typeof activity.meta === "object"
      ? (activity.meta as Record<string, unknown>)
      : {};

  if (activity.action === "field_changed" && typeof meta.field === "string") {
    const field = meta.field;
    const label = FIELD_LABEL[field] ?? field;
    const from = formatFieldValue(field, meta.from, lookups);
    const to = formatFieldValue(field, meta.to, lookups);
    return (
      <>
        {actorEl}님이 {label}
        {"을(를) "}
        <span className="line-through">{from}</span>{" "}
        <span aria-hidden>→</span>{" "}
        <span className="text-foreground font-medium">{to}</span> 로 변경
      </>
    );
  }

  if (activity.action === "status_changed" && typeof meta.status === "string") {
    const to = STATUS_META[meta.status as Status]?.label ?? meta.status;
    return (
      <>
        {actorEl}님이 상태를{" "}
        <span className="text-foreground font-medium">{to}</span> 로 변경
      </>
    );
  }

  if (
    activity.action === "dependency_added" ||
    activity.action === "dependency_removed"
  ) {
    const verb =
      activity.action === "dependency_added" ? "추가했습니다" : "제거했습니다";
    // role=blocking → 내가 막는 항목, blockedBy → 나를 막는(차단) 항목.
    const rel = meta.role === "blocking" ? "차단하는 항목" : "차단 항목";
    const label =
      typeof meta.key === "string"
        ? `${meta.key} ${String(meta.title ?? "")}`.trim()
        : "태스크";
    return (
      <>
        {actorEl}님이 {rel}{" "}
        <span className="text-foreground font-medium">{label}</span> {verb}
      </>
    );
  }

  switch (activity.action) {
    case "created":
      return <>{actorEl}님이 만들었습니다</>;
    case "commented":
      return <>{actorEl}님이 댓글을 남겼습니다</>;
    case "updated":
      return <>{actorEl}님이 수정했습니다</>;
    default:
      return (
        <>
          {actorEl}님이 {activity.action}
        </>
      );
  }
}
