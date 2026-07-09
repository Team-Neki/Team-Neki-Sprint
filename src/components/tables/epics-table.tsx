import Link from "next/link";
import type { Priority, Status } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import type { TeamOption } from "@/components/forms/fields";
import {
  InlineTitle,
  InlineStatus,
  InlinePriority,
  InlineMember,
} from "@/components/detail/inline-fields";
import { OpenDetailKey } from "./open-detail";
import { EmptyRow } from "./cells";

/**
 * 에픽 표의 한 행에 필요한 데이터.
 * `storyPoints` 는 하위 태스크 합(읽기전용 rollup) — Epic 자체엔 SP 필드가 없다.
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
  /** 하위 태스크 SP 합. 목록(getEpics)에서만 계산 — 하위목록에선 생략(→ "—"). */
  storyPoints?: number;
  ownerId?: string | null;
};

/** 목록 페이지에서 인라인 편집에 필요한 옵션 목록. */
export type EpicEditContext = {
  members: MiniUser[];
  teams: TeamOption[];
  projects: { id: string; title: string }[];
};

/**
 * 에픽 목록/하위목록 공용 표.
 * 컬럼: [키] [제목] [우선순위] [StoryPoint(하위 합)] [담당자] [상태]
 * - `edit` 제공(목록): 각 셀 인라인 편집(StoryPoint 은 rollup 이라 항상 읽기전용).
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
          <TableHead className="w-24">우선순위</TableHead>
          <TableHead className="w-24 text-right">SP</TableHead>
          <TableHead className="w-36">담당자</TableHead>
          <TableHead className="w-28">상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {epics.length === 0 ? (
          <EmptyRow colSpan={6} message={emptyMessage} />
        ) : (
          epics.map((e) => (
            <TableRow key={e.id}>
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
                  <InlinePriority type="epic" id={e.id} value={e.priority} />
                ) : (
                  <PriorityBadge priority={e.priority} />
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                {e.storyPoints || "—"}
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
              <TableCell>
                {edit ? (
                  <InlineStatus type="epic" id={e.id} value={e.status} />
                ) : (
                  <StatusBadge status={e.status} />
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
