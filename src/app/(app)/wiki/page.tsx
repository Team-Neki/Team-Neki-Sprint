import { BookText } from "lucide-react";
import { NewPageButton } from "@/components/wiki/new-page-button";

export default function WikiIndex() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="bg-muted flex size-14 items-center justify-center rounded-2xl">
        <BookText className="text-muted-foreground size-7" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">위키에 오신 걸 환영해요</h2>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          기획 문서, 회의록, 정책을 팀과 함께 작성하고 공유하세요. 왼쪽에서
          문서를 선택하거나 새 페이지를 만들어 시작하세요.
        </p>
      </div>
      <NewPageButton />
    </div>
  );
}
