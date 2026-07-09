import EpicDetail from "../../[id]/page";
import { DetailSheet } from "@/components/detail/detail-sheet";

export const dynamic = "force-dynamic";

/** 목록에서 에픽 key 클릭을 가로채 우측 슬라이드 상세로 띄운다(전체 상세 페이지 재사용). */
export default async function InterceptedEpicDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <DetailSheet fullHref={`/epics/${id}`}>
      <EpicDetail params={params} />
    </DetailSheet>
  );
}
