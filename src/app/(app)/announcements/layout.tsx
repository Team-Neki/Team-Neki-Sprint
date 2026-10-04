import { notFound } from "next/navigation";

/**
 * 공지 기능 스위치. ANNOUNCEMENTS_ENABLED=true 일 때만 /announcements 하위(목록·작성·상세)를
 * 연다. 꺼져 있으면 404. 스키마·서버 액션·쿼리는 그대로 두고 화면만 숨긴다(대시보드 카드도 동일 조건).
 */
export default function AnnouncementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.ANNOUNCEMENTS_ENABLED !== "true") notFound();
  return children;
}
