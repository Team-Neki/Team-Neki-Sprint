"use client";

// 공지 작성 버튼(위키 new-page-button 패턴). 빈 공지를 만들고 상세의 편집
// 모드(?edit=1)로 이동한다.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createAnnouncement } from "@/server/actions/announcements";

export function NewAnnouncementButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function create() {
    start(async () => {
      try {
        const { id } = await createAnnouncement();
        router.push(`/announcements/${id}?edit=1`);
        router.refresh();
      } catch {
        toast.error("공지 생성에 실패했습니다");
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={create} disabled={pending}>
      <Plus className="size-4" /> 공지 작성
    </Button>
  );
}
