import TaskDetail from "../../[id]/page";
import { DetailSheet } from "@/components/detail/detail-sheet";

export const dynamic = "force-dynamic";

/**
 * 목록에서 태스크 key 클릭(소프트 내비)을 가로채 우측 슬라이드 상세로 띄운다.
 * 상세 본문은 전체 상세 페이지 컴포넌트([id]/page)를 그대로 재사용한다.
 */
export default async function InterceptedTaskDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <DetailSheet fullHref={`/tasks/${id}`}>
      <TaskDetail params={params} />
    </DetailSheet>
  );
}
