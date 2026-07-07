import { Plus, Rocket } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { getSprints } from "@/server/queries";
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
import { TableRowLink } from "@/components/ui/table-row-link";
import { SprintStatusBadge } from "@/components/badges";
import { SprintDialog } from "@/components/forms/sprint-dialog";

export const dynamic = "force-dynamic";

function dateRange(start: Date | null, end: Date | null) {
  const fmt = (d: Date) => format(d, "yyyy.M.d", { locale: ko });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `${fmt(start)} –`;
  if (end) return `– ${fmt(end)}`;
  return "기간 미설정";
}

export default async function SprintsPage() {
  const sprints = await getSprints();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="스프린트"
        description="기간 단위로 팀 횡단 프로젝트를 묶어 관리합니다."
      >
        <SprintDialog
          trigger={
            <Button>
              <Plus className="size-4" /> 새 스프린트
            </Button>
          }
        />
      </PageHeader>

      {sprints.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Rocket className="text-muted-foreground size-6" />
          </div>
          <p className="text-muted-foreground text-sm">아직 스프린트가 없습니다.</p>
          <SprintDialog
            trigger={
              <Button variant="outline">
                <Plus className="size-4" /> 첫 스프린트 만들기
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead className="w-56">기간</TableHead>
                <TableHead className="w-24 text-right">프로젝트</TableHead>
                <TableHead className="w-24">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sprints.map((s) => (
                <TableRowLink key={s.id} href={`/sprints/${s.id}`}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {dateRange(s.startDate, s.endDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                    {s._count.projects}
                  </TableCell>
                  <TableCell>
                    <SprintStatusBadge status={s.status} />
                  </TableCell>
                </TableRowLink>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
