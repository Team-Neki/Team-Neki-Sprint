import { getTimelineEpics } from "@/server/queries";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EpicTimeline } from "@/components/timeline/epic-timeline";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const epics = await getTimelineEpics();

  return (
    <div>
      <PageHeader
        title="타임라인"
        description="프로젝트별 에픽 일정을 한눈에. 에픽을 펼치면 하위 태스크가 보입니다."
      >
        <div className="hidden items-center gap-3 sm:flex">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span className="h-3 w-4 rounded-sm bg-neutral-300" /> 에픽
          </span>
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span className="h-2 w-4 rounded-sm bg-neutral-500" /> 태스크
          </span>
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
