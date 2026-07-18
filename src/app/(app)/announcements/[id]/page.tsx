import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import type { JSONContent } from "@tiptap/react";
import { getAnnouncement } from "@/server/queries";
import { requireUser } from "@/lib/session";
import { AnnouncementDetail } from "@/components/announcements/announcement-detail";

export const dynamic = "force-dynamic";

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function asDoc(content: unknown): JSONContent {
  if (
    content &&
    typeof content === "object" &&
    "type" in content &&
    (content as { type?: string }).type === "doc"
  ) {
    return content as JSONContent;
  }
  return EMPTY_DOC;
}

export default async function AnnouncementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ id }, { edit }] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const announcement = await getAnnouncement(id);
  if (!announcement) notFound();

  const updatedLabel = `${formatDistanceToNow(announcement.updatedAt, {
    addSuffix: true,
    locale: ko,
  })} 수정`;

  // 삭제는 작성자만(요구사항). 작성자가 사라진(null) 공지는 ADMIN 이 정리.
  const canDelete = announcement.author
    ? announcement.author.id === user.id
    : user.role === "ADMIN";

  return (
    <div className="pb-16">
      <AnnouncementDetail
        id={announcement.id}
        title={announcement.title}
        content={asDoc(announcement.content)}
        author={announcement.author}
        updatedLabel={updatedLabel}
        canDelete={canDelete}
        initialEdit={edit === "1"}
      />
    </div>
  );
}
