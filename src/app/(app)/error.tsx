"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * (app) 세그먼트 공용 에러 바운더리. 서버 컴포넌트/액션이 렌더 중 throw 하면
 * Next 가 이 경계로 폴백한다(앱 셸 레이아웃은 유지, 본문만 교체). reset() 은
 * 세그먼트를 재렌더해 재시도한다. 하위 세그먼트에 자체 error.tsx 가 없으면 상속.
 *
 * 주의: 원격 에러 리포팅(Sentry 등)을 붙이려면 여기 useEffect 에서 error.digest 로
 * 상관관계를 남긴다(현재 프로젝트는 콘솔/외부로그 미도입이라 UI 폴백만 제공).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h2 className="text-lg font-semibold">문제가 발생했습니다</h2>
      <p className="text-muted-foreground text-sm">
        이 페이지를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
      </p>
      {error.digest && (
        <p className="text-muted-foreground font-mono text-xs">
          오류 ID: {error.digest}
        </p>
      )}
      <Button onClick={reset}>
        <RotateCcw className="size-4" />
        다시 시도
      </Button>
    </div>
  );
}
