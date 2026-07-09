/**
 * 에픽 세그먼트 레이아웃. `@detail` 병렬 슬롯으로 목록의 key 클릭을 우측 슬라이드 상세로
 * 가로챈다(intercepting route). 하드 로드/새 탭은 children 의 [id]/page 전체 상세.
 */
export default function EpicsSegmentLayout({
  children,
  detail,
}: {
  children: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <>
      {children}
      {detail}
    </>
  );
}
