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
        {/* 범례: 상태 2색 체계(에픽·태스크 공통). 스와치 폭을 넓혀 가독성 확보. */}
        <div className="hidden items-center gap-4 sm:flex">
          <span className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="h-3 w-7 rounded bg-blue-500" /> 진행 중
          </span>
          <span className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="h-3 w-7 rounded bg-emerald-500" /> 완료
          </span>
        </div>
      </PageHeader>

      {/* 에픽이 없어도 타임라인(축·그리드)을 렌더해 좌우로 무한 스크롤할 수 있게 한다. */}
      <Card className="p-5">
        <EpicTimeline epics={epics} today={new Date()} />
      </Card>
    </div>
  );
}
