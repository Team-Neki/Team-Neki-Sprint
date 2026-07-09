import { Skeleton } from "@/components/ui/skeleton";

/**
 * 상세 시트 스트리밍용 스켈레톤. 인터셉트 페이지에서 시트(client)는 즉시 슬라이드로
 * 띄우고, 데이터가 무거운 상세 본문만 <Suspense>로 감싸 이 스켈레톤을 먼저 보여준다.
 * 덕분에 (app)/loading 전체화면 플래시 없이 목록이 유지된 채 시트 내부만 채워진다.
 * 시트 폭에선 단일 컬럼이므로 세로 스택 형태로 맞춘다.
 */
export function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">불러오는 중…</span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-2/3" />
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
      <div className="space-y-3 rounded-lg border p-5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
