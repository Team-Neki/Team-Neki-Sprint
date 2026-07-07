import { cn } from "@/lib/utils";

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * 롤업 MD(맨데이) 표시(읽기전용, B7). Epic=하위 태스크 합, Project=하위 에픽 합.
 * "예상 12 / 실제 8 MD" 형태. 둘 다 0이면 미기입 표시.
 */
export function MdRollupText({
  estimated,
  actual,
  className,
}: {
  estimated: number;
  actual: number;
  className?: string;
}) {
  if (estimated === 0 && actual === 0) {
    return <span className={cn("text-muted-foreground", className)}>MD 미기입</span>;
  }
  return (
    <span className={className}>
      예상 {fmt(estimated)} <span className="text-muted-foreground">/</span> 실제{" "}
      {fmt(actual)} MD
    </span>
  );
}
