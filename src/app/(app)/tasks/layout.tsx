/**
 * 태스크 세그먼트 레이아웃. `@detail` 병렬 슬롯을 함께 렌더해, 목록에서 태스크 key 를
 * 소프트 내비게이션으로 열면 intercepting route(@detail/(.)[id])가 우측 슬라이드 상세로
 * 가로챈다. 하드 로드/새 탭은 children 의 [id]/page 전체 상세가 뜬다.
 */
export default function TasksSegmentLayout({
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
