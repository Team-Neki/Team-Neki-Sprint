import Link from "next/link";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { Status } from "@prisma/client";
import { getTasks, getEpics, getMembers } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/badges";
import { UserBadge } from "@/components/user-badge";
import { TaskDialog } from "@/components/forms/task-dialog";
import { TaskFilters } from "@/components/tasks/task-filters";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assignee?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const [tasks, epics, members] = await Promise.all([
    getTasks({
      status: (sp.status as Status) || undefined,
      assigneeId: sp.assignee || undefined,
      q: sp.q || undefined,
    }),
    getEpics(),
    getMembers(),
  ]);

  return (
    <div>
      <PageHeader title="태스크" description="모든 태스크를 표로 관리하세요.">
        <TaskDialog
          members={members}
          epics={epics.map((e) => ({ id: e.id, title: e.title }))}
          trigger={
            <Button>
              <Plus className="size-4" /> 새 태스크
            </Button>
          }
        />
      </PageHeader>

      <TaskFilters members={members} />

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">키</TableHead>
              <TableHead>제목</TableHead>
              <TableHead className="w-40">에픽</TableHead>
              <TableHead className="w-20">우선순위</TableHead>
              <TableHead className="w-28">담당자</TableHead>
              <TableHead className="w-24">마감</TableHead>
              <TableHead className="w-24">상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground py-12 text-center text-sm"
                >
                  조건에 맞는 태스크가 없습니다.
                </TableCell>
              </TableRow>
            )}
            {tasks.map((t) => (
              <TableRow key={t.id} className="cursor-pointer">
                <TableCell className="text-muted-foreground font-mono text-xs">
                  <Link href={`/tasks/${t.id}`} className="block">
                    TASK-{t.key}
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/tasks/${t.id}`} className="block">
                    {t.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground truncate text-xs">
                  {t.epic?.title ?? "—"}
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={t.priority} />
                </TableCell>
                <TableCell>
                  <UserBadge user={t.assignee} hideName />
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {t.dueDate ? format(t.dueDate, "M.d", { locale: ko }) : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={t.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
