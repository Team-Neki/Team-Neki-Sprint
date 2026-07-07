import Link from "next/link";
import { Plus, Rocket } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { getSprints } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <div>
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
        <div className="flex flex-col gap-2">
          {sprints.map((s) => (
            <Link key={s.id} href={`/sprints/${s.id}`}>
              <Card className="hover:border-primary/40 flex flex-row items-center gap-4 px-4 py-3 transition-colors">
                <span className="min-w-0 flex-1 truncate font-medium">
                  {s.name}
                </span>
                <span className="text-muted-foreground hidden text-xs sm:block">
                  {dateRange(s.startDate, s.endDate)}
                </span>
                <span className="text-muted-foreground text-xs">
                  프로젝트 {s._count.projects}
                </span>
                <SprintStatusBadge status={s.status} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
