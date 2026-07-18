import { requireUser } from "@/lib/session";
import { AnnouncementCreate } from "@/components/announcements/announcement-create";

/**
 * 새 공지 작성 화면. 여기서 '저장'을 눌러야 비로소 공지가 생성된다(취소 시 아무것도
 * 남지 않음). 예전엔 '공지 작성' 클릭 즉시 빈 공지가 만들어져, 취소해도 남던 문제 해결.
 */
export default async function NewAnnouncementPage() {
  await requireUser();
  return (
    <div className="pb-16">
      <AnnouncementCreate />
    </div>
  );
}
