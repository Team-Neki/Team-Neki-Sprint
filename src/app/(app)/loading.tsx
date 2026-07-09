import { Skeleton } from "@/components/ui/skeleton";

/**
 * (app) 세그먼트 공용 로딩 스켈레톤. 페이지가 force-dynamic 이라 소프트 내비게이션
 * 시 서버 렌더를 기다리는 동안 빈 화면 대신 이 스켈레톤을 보여준다(하위 세그먼트에
 * 자체 loading.tsx 가 없으면 이걸 상속). 특정 화면에 더 맞는 스켈레톤이 필요하면
 * 해당 세그먼트에 loading.tsx 를 추가한다.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4" aria-busy="true">
      <span className="sr-only">불러오는 중…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
