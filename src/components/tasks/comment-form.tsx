"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addComment } from "@/server/actions/tasks";

export function CommentForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    if (!body.trim()) return;
    start(async () => {
      try {
        await addComment(taskId, body);
        setBody("");
        router.refresh();
      } catch {
        toast.error("댓글 등록에 실패했습니다");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="댓글을 남겨보세요…"
        rows={2}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={pending || !body.trim()}>
          {pending ? "등록 중…" : "댓글 등록"}
        </Button>
      </div>
    </div>
  );
}
