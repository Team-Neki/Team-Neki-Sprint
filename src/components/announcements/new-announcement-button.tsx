"use client";

// 공지 작성: 즉시 생성하지 않고 작성 화면(/announcements/new)으로 이동한다. 실제 생성은
// 그 화면에서 '저장'을 눌렀을 때만 일어난다(작성 버튼→취소 시 빈 공지가 남던 문제 해결).

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NewAnnouncementButton() {
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => router.push("/announcements/new")}
    >
      <Plus className="size-4" /> 공지 작성
    </Button>
  );
}
