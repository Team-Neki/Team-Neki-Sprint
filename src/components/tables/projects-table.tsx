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
import { StatusBadge, PriorityBadge, LabelBadge } from "@/components/badges";
import { UserBadge, type MiniUser } from "@/components/user-badge";
import {
  InlineTitle,
  InlineStatus,
  InlinePriority,
  InlineMember,
  InlineDate,
} from "@/components/detail/inline-fields";
import { OpenDetailIcon } from "./open-detail";
import { EmptyRow } from "./cells";

/**
 * 프로젝트 표의 한 행에 필요한 데이터. 프로젝트는 이슈 key 가 없다(팀 접두어 미부여).
 * 레이블은 표시 전용(프로젝트 라벨 부여 UI 는 미구현 — 후속).
 */
export type ProjectTableRow = {
  id: string;
  title: string;
  priority: Priority;
  status: Status;
  owner: MiniUser | null;
  dueDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  labels?: { label: { id: string; name: string; color: string } }[];
  ownerId?: string | null;
};

/** 목록 페이지에서 인라인 편집에 필요한 옵션 목록. */
export type ProjectEditContext = {
  members: MiniUser[];
  sprints: { id: string; name: string }[];
};

const fmt = (d: Date | null | undefined) =>
  d ? format(d, "yyyy.M.d", { locale: ko }) : "—";

/**
 * 프로젝트 목록/하위목록 공용 표.
 * 컬럼: [제목] [상태] [담당자] [기한] [우선순위] [레이블] [생성시간] [수정시간] [열기]
 * - `edit` 제공(목록): 제목·상태·담당자·기한·우선순위 인라인 편집. 레이블·시간은 읽기전용.
 * - 열기 셀: 패널 아이콘 클릭 = 우측 슬라이드 상세, ↗ = 새 탭 전체 페이지.
 */
export function ProjectsTable({
  projects,
  emptyMessage = "프로젝트가 없습니다.",
  edit,
}: {
  projects: ProjectTableRow[];
  emptyMessage?: string;
  edit?: ProjectEditContext;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>제목</TableHead>
          <TableHead className="w-28">상태</TableHead>
          <TableHead className="w-32">담당자</TableHead>
          <TableHead className="w-28">기한</TableHead>
          <TableHead className="w-24">우선순위</TableHead>
          <TableHead className="w-40">레이블</TableHead>
          <TableHead className="w-24">생성시간</TableHead>
          <TableHead className="w-24">수정시간</TableHead>
          <TableHead className="w-16">
            <span className="sr-only">열기</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.length === 0 ? (
          <EmptyRow colSpan={9} message={emptyMessage} />
        ) : (
          projects.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">
                {edit ? (
                  <InlineTitle
                    type="project"
                    id={p.id}
                    value={p.title}
                    className="text-sm font-medium"
                  />
                ) : (
                  p.title
                )}
              </TableCell>
              <TableCell>
                {edit ? (
                  <InlineStatus type="project" id={p.id} value={p.status} />
                ) : (
                  <StatusBadge status={p.status} />
                )}
              </TableCell>
              <TableCell>
                {edit ? (
                  <InlineMember
                    type="project"
                    id={p.id}
                    field="ownerId"
                    value={p.owner}
                    members={edit.members}
                  />
                ) : (
                  <UserBadge user={p.owner} hideName />
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {edit ? (
                  <InlineDate
                    type="project"
                    id={p.id}
                    field="dueDate"
                    value={p.dueDate ?? null}
                  />
                ) : (
                  fmt(p.dueDate)
                )}
              </TableCell>
              <TableCell>
                {edit ? (
                  <InlinePriority type="project" id={p.id} value={p.priority} />
                ) : (
                  <PriorityBadge priority={p.priority} />
                )}
              </TableCell>
              <TableCell>
                <span className="flex flex-wrap items-center gap-1">
                  {p.labels?.length
                    ? p.labels.map((l) => (
                        <LabelBadge
                          key={l.label.id}
                          name={l.label.name}
                          color={l.label.color}
                        />
                      ))
                    : "—"}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground text-xs tabular-nums">
                {fmt(p.createdAt)}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs tabular-nums">
                {fmt(p.updatedAt)}
              </TableCell>
              <TableCell>
                <OpenDetailIcon href={`/projects/${p.id}`} />
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
