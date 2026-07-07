import { formatDistanceToNow, format } from "date-fns";
import { ko } from "date-fns/locale";
import type { Status, Priority } from "@prisma/client";
import { STATUS_META, PRIORITY_META } from "@/lib/constants";
import { UserBadge, type MiniUser } from "@/components/user-badge";

export type ActivityItem = {
  id: string;
  action: string;
  meta: unknown;
  createdAt: Date | string;
  user: MiniUser | null;
};

type NamedRef = { id: string; title?: string; name?: string };

// 필드 → 한국어 라벨.
const FIELD_LABEL: Record<string, string> = {
  title: "제목",
  description: "설명",
  status: "상태",
  priority: "우선순위",
  assigneeId: "담당자",
  ownerId: "담당자",
  reporterId: "보고자",
  epicId: "에픽",
  projectId: "프로젝트",
  sprintId: "스프린트",
  startDate: "시작일",
  dueDate: "기한",
  storyPoints: "스토리포인트",
  estimatedMd: "예상 MD",
  actualMd: "실제 MD",
};

function truncate(s: string, n = 40): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function buildMap(items?: NamedRef[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const it of items ?? []) m.set(it.id, it.title ?? it.name ?? it.id);
  return m;
}

/** field_changed meta 의 raw from/to 값을 사람이 읽는 문자열로 포맷. */
function formatValue(
  field: string,
  raw: unknown,
  lookups: {
    members: Map<string, string>;
    epics: Map<string, string>;
    projects: Map<string, string>;
    sprints: Map<string, string>;
  },
): string {
  if (raw == null || raw === "") return "없음";
  const s = String(raw);
  switch (field) {
    case "status":
      return STATUS_META[raw as Status]?.label ?? s;
    case "priority":
      return PRIORITY_META[raw as Priority]?.label ?? s;
    case "startDate":
    case "dueDate": {
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : format(d, "yyyy.M.d", { locale: ko });
    }
    case "assigneeId":
    case "ownerId":
    case "reporterId":
      return lookups.members.get(s) ?? "사용자";
    case "epicId":
      return lookups.epics.get(s) ?? "에픽";
    case "projectId":
      return lookups.projects.get(s) ?? "프로젝트";
    case "sprintId":
      return lookups.sprints.get(s) ?? "스프린트";
    case "title":
    case "description":
      return truncate(s);
    default:
      return s;
  }
}

function actorName(user: MiniUser | null): string {
  return user?.name ?? user?.email ?? "누군가";
}

/**
 * 업무 히스토리 패널(B8). 엔티티 Activity 를 최신순 한국어 문장으로 렌더한다.
 * field_changed 이벤트는 "X님이 <필드>를 A → B 로 변경"으로, 나머지(생성/댓글 등)는
 * 간단한 문장으로 표시. 관계 필드(담당자/에픽/…)는 전달된 목록으로 이름을 해석한다.
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
  const lookups = {
    members: buildMap(members.map((m) => ({ id: m.id, name: m.name ?? m.email }))),
    epics: buildMap(epics),
    projects: buildMap(projects),
    sprints: buildMap(sprints),
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
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
  lookups: Parameters<typeof formatValue>[2];
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
    const from = formatValue(field, meta.from, lookups);
    const to = formatValue(field, meta.to, lookups);
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
