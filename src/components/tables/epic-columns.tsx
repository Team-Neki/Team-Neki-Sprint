import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { Priority, Status } from "@prisma/client";
import { TableCell } from "@/components/ui/table";
import { StatusBadge, PriorityBadge, LabelBadge } from "@/components/badges";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import type { TeamOption } from "@/components/forms/fields";
import {
  InlineTitle,
  InlineStatus,
  InlinePriority,
  InlineMember,
  InlineDate,
} from "@/components/detail/inline-fields";
import { EpicLabels } from "@/components/detail/epic-labels";
import type { LabelItem } from "@/components/detail/entity-labels";
import { OpenDetailKey } from "./open-detail";
import type { ColumnDef, ColumnMeta } from "./column-registry";

/**
 * 에픽 표의 한 행에 필요한 데이터.
 * `estimatedMd` 는 하위 태스크 MD 합(읽기전용 rollup) — Epic 자체엔 MD 필드가 없다.
 */
export type EpicTableRow = {
  id: string;
  number: number;
  title: string;
  priority: Priority;
  status: Status;
  team: { key: string } | null;
  teamId: string;
  owner: MiniUser | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  labels?: { label: { id: string; name: string; color: string } }[];
  /** 하위 태스크 예상 MD 합. 목록(getEpics)에서만 계산 — 하위목록에선 생략(→ "—"). */
  estimatedMd?: number;
  ownerId?: string | null;
};

/** 목록 페이지에서 인라인 편집에 필요한 옵션 목록. */
export type EpicEditContext = {
  members: MiniUser[];
  teams: TeamOption[];
  projects: { id: string; title: string }[];
  labels: LabelItem[];
};

/** 에픽 행 삭제 확인 문구(`EntityTable` `deleteDescription`). */
export const EPIC_DELETE_DESCRIPTION =
  "에픽이 삭제됩니다. 하위 태스크는 삭제되지 않고 에픽 연결만 해제됩니다.";

const fmt = (d: Date | null | undefined) =>
  d ? format(d, "yyyy.M.d", { locale: ko }) : "—";

/**
 * 에픽 표 컬럼 정의(F4). `EntityTable` 에 주입한다. 각 `cell` 은
 * `edit ? <Inline/> : <읽기전용/>`.
 * 컬럼: [키] [제목] [담당자] [시작일] [종료일] [우선순위] [상태] [레이블] [MD]
 * - 프로젝트/태스크 표와 동일한 공통 컬럼 순서. MD(하위 롤업)는 항상 읽기전용.
 */
export const EPIC_COLUMNS: ColumnDef<EpicTableRow, EpicEditContext>[] = [
  {
    key: "key",
    label: "키",
    headClassName: "w-28",
    cell: (e) => (
      <TableCell>
        <OpenDetailKey
          href={`/epics/${e.id}`}
          teamKey={e.team?.key}
          number={e.number}
        />
      </TableCell>
    ),
  },
  {
    key: "title",
    label: "제목",
    cell: (e, edit) => (
      <TableCell className="font-medium">
        {edit ? (
          <InlineTitle
            type="epic"
            id={e.id}
            value={e.title}
            href={`/epics/${e.id}`}
            className="text-sm font-medium"
          />
        ) : (
          <Link href={`/epics/${e.id}`} className="hover:underline">
            {e.title}
          </Link>
        )}
      </TableCell>
    ),
  },
  {
    key: "assignee",
    label: "담당자",
    headClassName: "w-32",
    cell: (e, edit) => (
      <TableCell>
        {edit ? (
          <InlineMember
            type="epic"
            id={e.id}
            field="ownerId"
            value={e.owner}
            members={edit.members}
            avatarOnly
          />
        ) : (
          <UserBadge user={e.owner} hideName />
        )}
      </TableCell>
    ),
  },
  {
    key: "startDate",
    label: "시작일",
    headClassName: "w-28",
    cell: (e, edit) => (
      <TableCell className="text-muted-foreground text-xs">
        {edit ? (
          <InlineDate
            type="epic"
            id={e.id}
            field="startDate"
            value={e.startDate ?? null}
          />
        ) : (
          fmt(e.startDate)
        )}
      </TableCell>
    ),
  },
  {
    key: "dueDate",
    label: "종료일",
    headClassName: "w-28",
    cell: (e, edit) => (
      <TableCell className="text-muted-foreground text-xs">
        {edit ? (
          <InlineDate
            type="epic"
            id={e.id}
            field="dueDate"
            value={e.dueDate ?? null}
          />
        ) : (
          fmt(e.dueDate)
        )}
      </TableCell>
    ),
  },
  {
    key: "priority",
    label: "우선순위",
    headClassName: "w-24",
    cell: (e, edit) => (
      <TableCell>
        {edit ? (
          <InlinePriority type="epic" id={e.id} value={e.priority} />
        ) : (
          <PriorityBadge priority={e.priority} />
        )}
      </TableCell>
    ),
  },
  {
    key: "status",
    label: "상태",
    headClassName: "w-28",
    cell: (e, edit) => (
      <TableCell>
        {edit ? (
          <InlineStatus type="epic" id={e.id} value={e.status} />
        ) : (
          <StatusBadge status={e.status} />
        )}
      </TableCell>
    ),
  },
  {
    key: "labels",
    label: "레이블",
    headClassName: "w-40",
    // 라벨 셀: auto-layout 표에서 컬럼이 밀리지 않도록 폭을 헤더(w-40)에
    // 맞춰 상한 두고 넘치면 줄바꿈(가로 blowout 방지).
    cell: (e, edit) => (
      <TableCell>
        {edit ? (
          <div className="max-w-40">
            <EpicLabels
              epicId={e.id}
              labels={e.labels?.map((l) => l.label) ?? []}
              allLabels={edit.labels}
              align="start"
              layout="row"
            />
          </div>
        ) : (
          <span className="flex max-w-40 flex-wrap items-center gap-1">
            {e.labels?.length
              ? e.labels.map((l) => (
                  <LabelBadge
                    key={l.label.id}
                    name={l.label.name}
                    color={l.label.color}
                  />
                ))
              : "—"}
          </span>
        )}
      </TableCell>
    ),
  },
  {
    key: "md",
    label: "MD",
    headClassName: "w-20",
    cell: (e) => (
      <TableCell className="text-muted-foreground text-sm tabular-nums">
        {e.estimatedMd || "—"}
      </TableCell>
    ),
  },
];

/** 설정 UI·목록 페이지가 참조하는 기본 순서 컬럼 메타(렌더 함수 제외). */
export const EPICS_COLUMNS_META: ColumnMeta[] = EPIC_COLUMNS.map((c) => ({
  key: c.key,
  label: c.label,
}));
