import { getTimelineEpics } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EpicTimeline } from "@/components/timeline/epic-timeline";
import { STATUS_ORDER, STATUS_META } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const epics = await getTimelineEpics();

  return (
    <div>
      <PageHeader
        title="타임라인"
        description="이니셔티브별 에픽 일정을 한눈에. 에픽을 펼치면 하위 태스크가 보입니다."
      >
        <div className="hidden items-center gap-3 sm:flex">
          {STATUS_ORDER.map((s) => (
            <span key={s} className="text-muted-foreground flex items-center gap-1 text-xs">
              <span className={`size-2 rounded-full ${STATUS_META[s].dot}`} />
              {STATUS_META[s].label}
            </span>
          ))}
        </div>
      </PageHeader>

      {epics.length === 0 ? (
        <Card className="text-muted-foreground py-16 text-center text-sm">
          에픽이 없습니다. 에픽과 태스크에 날짜를 설정하면 타임라인에 표시됩니다.
        </Card>
      ) : (
        <Card className="p-5">
          <EpicTimeline epics={epics} today={new Date()} />
        </Card>
      )}
    </div>
  );
}
