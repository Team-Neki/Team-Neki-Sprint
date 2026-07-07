"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Folder } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { movePageToFolder } from "@/server/actions/wiki";

const NONE = "__none__";

export type FolderOption = { id: string; name: string };

/** 페이지를 폴더로 이동(또는 폴더 밖으로 빼기). 위키 페이지 헤더에 노출. */
export function PageFolderSelect({
  pageId,
  folderId,
  folders,
}: {
  pageId: string;
  folderId: string | null;
  folders: FolderOption[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(folderId ?? NONE);
  const [pending, start] = useTransition();

  function change(next: string | null) {
    const target = next ?? NONE;
    const prev = value;
    setValue(target);
    start(async () => {
      try {
        await movePageToFolder(pageId, target === NONE ? null : target);
        router.refresh();
      } catch {
        setValue(prev);
        toast.error("폴더 이동에 실패했습니다");
      }
    });
  }

  return (
    <Select value={value} onValueChange={change} disabled={pending}>
      <SelectTrigger size="sm" className="h-7 gap-1.5 text-xs">
        <Folder className="text-muted-foreground size-3.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>폴더 없음</SelectItem>
        {folders.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
