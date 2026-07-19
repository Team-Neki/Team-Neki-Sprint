import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { Priority, Status } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RowContextMenu } from "@/components/tables/row-context-menu";
import { deleteEpic } from "@/server/actions/epics";
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
import { EmptyRow } from "./cells";

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

const fmt = (d: Date | null | undefined) =>
  d ? format(d, "yyyy.M.d", { locale: ko }) : "—";

/**
 * 에픽 목록/하위목록 공용 표.
 * 컬럼: [키] [제목] [담당자] [시작일] [종료일] [우선순위] [상태] [레이블] [MD]
 * - 프로젝트/태스크 표와 동일한 공통 컬럼 순서(제목→담당자→시작일→종료일→우선순위→상태→레이블).
 *   키(식별자)는 맨 앞, MD(하위 롤업)는 맨 뒤에 둔다.
 * - `edit` 제공(목록): 각 셀 인라인 편집(MD 는 rollup 이라 항상 읽기전용).
 * - 키 클릭: 우측 슬라이드 상세, ↗: 새 탭 전체 페이지.
 */
export function EpicsTable({
  epics,
  emptyMessage = "에픽이 없습니다.",
  edit,
}: {
  epics: EpicTableRow[];
  emptyMessage?: string;
  edit?: EpicEditContext;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">키</TableHead>
          <TableHead>제목</TableHead>
          <TableHead className="w-32">담당자</TableHead>
          <TableHead className="w-28">시작일</TableHead>
          <TableHead className="w-28">종료일</TableHead>
          <TableHead className="w-24">우선순위</TableHead>
          <TableHead className="w-28">상태</TableHead>
          <TableHead className="w-40">레이블</TableHead>
          <TableHead className="w-20">MD</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {epics.length === 0 ? (
          <EmptyRow colSpan={9} message={emptyMessage} />
        ) : (
          epics.map((e) => {
            const cells = (
              <>
              <TableCell>
                <OpenDetailKey
                  href={`/epics/${e.id}`}
                  teamKey={e.team?.key}
                  number={e.number}
                />
              </TableCell>
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
              <TableCell>
                {edit ? (
                  <InlinePriority type="epic" id={e.id} value={e.priority} />
                ) : (
                  <PriorityBadge priority={e.priority} />
                )}
              </TableCell>
              <TableCell>
                {edit ? (
                  <InlineStatus type="epic" id={e.id} value={e.status} />
                ) : (
                  <StatusBadge status={e.status} />
                )}
              </TableCell>
              {/* 라벨 셀: auto-layout 표에서 컬럼이 밀리지 않도록 폭을 헤더(w-40)에
                  맞춰 상한 두고 넘치면 줄바꿈(가로 blowout 방지). */}
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
              <TableCell className="text-muted-foreground text-sm tabular-nums">
                {e.estimatedMd || "—"}
              </TableCell>
              </>
            );
            return edit ? (
              <RowContextMenu
                key={e.id}
                href={`/epics/${e.id}`}
                id={e.id}
                deleteAction={deleteEpic}
                deleteDescription="에픽이 삭제됩니다. 하위 태스크는 삭제되지 않고 에픽 연결만 해제됩니다."
              >
                {cells}
              </RowContextMenu>
            ) : (
              <TableRow key={e.id}>{cells}</TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
