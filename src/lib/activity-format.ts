import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { Status, Priority } from "@prisma/client";
import { STATUS_META, PRIORITY_META } from "@/lib/constants";

/**
 * 업무 히스토리/최근 활동 공용 포맷터.
 * Activity.meta(diffFields 가 저장한 raw from/to)를 사람이 읽는 한국어로 해석한다.
 * 히스토리 패널(리치 JSX)과 대시보드(plain 문장)가 같은 라벨·값 해석을 공유한다.
 */

export type NamedRef = { id: string; title?: string; name?: string };
export type Lookups = {
  members: Map<string, string>;
  epics: Map<string, string>;
  projects: Map<string, string>;
  sprints: Map<string, string>;
};

// 필드 → 한국어 라벨.
export const FIELD_LABEL: Record<string, string> = {
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

export function truncateText(s: string, n = 40): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function toMap(items?: NamedRef[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const it of items ?? []) m.set(it.id, it.title ?? it.name ?? it.id);
  return m;
}

export function buildLookups(src: {
  members?: { id: string; name: string | null; email: string }[];
  epics?: NamedRef[];
  projects?: NamedRef[];
  sprints?: NamedRef[];
}): Lookups {
  return {
    members: toMap(
      src.members?.map((m) => ({ id: m.id, name: m.name ?? m.email })),
    ),
    epics: toMap(src.epics),
    projects: toMap(src.projects),
    sprints: toMap(src.sprints),
  };
}

/** field_changed meta 의 raw from/to 값을 사람이 읽는 문자열로. */
export function formatFieldValue(
  field: string,
  raw: unknown,
  lookups: Lookups,
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
      return truncateText(s);
    default:
      return s;
  }
}

/**
 * actor 를 제외한 변경 설명(plain 문자열). 예: "상태를 백로그 → 진행중 로 변경".
 * 대시보드 최근 활동처럼 배우(누가)·대상(무엇)을 별도로 렌더하는 곳에서 이 절만 붙인다.
 */
export function activityDescription(
  action: string,
  meta: unknown,
  lookups: Lookups,
): string {
  const m =
    meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
  if (action === "field_changed" && typeof m.field === "string") {
    const label = FIELD_LABEL[m.field] ?? m.field;
    const from = formatFieldValue(m.field, m.from, lookups);
    const to = formatFieldValue(m.field, m.to, lookups);
    return `${label} ${from} → ${to} 로 변경`;
  }
  if (action === "status_changed" && typeof m.status === "string") {
    const to = STATUS_META[m.status as Status]?.label ?? String(m.status);
    return `상태를 ${to} 로 변경`;
  }
  switch (action) {
    case "created":
      return "생성";
    case "commented":
      return "댓글 작성";
    case "updated":
      return "수정";
    case "deleted":
      return "삭제";
    default:
      return action;
  }
}
