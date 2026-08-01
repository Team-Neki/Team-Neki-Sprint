import { cn } from "@/lib/utils";

/**
 * 목록 화면 상단의 필터 바 한 줄.
 *
 * 각 필터 컴포넌트는 자기 칩(+초기화 버튼)만 렌더하고, 줄바꿈·간격·아래 여백은 이 셸이
 * 소유한다. 과거엔 필터들이 서로를 `children` 으로 감싸며 각자 `mb-4 flex ...` 래퍼를
 * 만들었는데, 중첩되면 안쪽 래퍼의 `mb-4` 가 그 flex 아이템 높이를 부풀려 바깥
 * `items-center` 가 첫 칩을 아래로 8px 밀어냈다(상태·오너·팀 y축 어긋남의 원인).
 */
export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}
