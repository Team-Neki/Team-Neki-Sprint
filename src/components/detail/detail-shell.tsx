import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BackButton } from "@/components/detail/back-button";
import { SheetDeleteButton } from "@/components/detail/sheet-delete-button";
import { InlineDescription } from "@/components/detail/inline-description";
import { MetaRow } from "@/components/detail/inline-fields";
import { MdRollupText } from "@/components/detail/md-rollup";
import { TaskProgressSummary } from "@/components/detail/task-progress";
import type { TaskProgress } from "@/lib/task-progress";

/*
 * 상세 4종(태스크·에픽·프로젝트·스프린트)이 똑같이 쓰는 블록. 슬롯만 받는 얇은 조각이라
 * 모양·간격은 여기서만 고친다(한 화면만 고치면 그 자리에서 갈린다). 배치 규격은
 * docs/design-system.md "상세 화면".
 */

/** 뒤로가기 + (이슈 key) + 제목 + 삭제. 뒤로가기와 삭제 후 이동은 모두 자기 목록(`href`). */
export function DetailHeader({
  href,
  label,
  issueKey,
  title,
  onDelete,
}: {
  href: string;
  label: string;
  /** 팀 접두어 key. 태스크·에픽만 있다. */
  issueKey?: string;
  /** `InlineTitle` 슬롯. */
  title: React.ReactNode;
  onDelete: () => Promise<void>;
}) {
  return (
    <>
      <BackButton fallback={href} label={label} />
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {issueKey && (
            <span className="text-muted-foreground font-mono text-xs">
              {issueKey}
            </span>
          )}
          {title}
        </div>
        <SheetDeleteButton onConfirm={onDelete} redirectTo={href} />
      </div>
    </>
  );
}

/** 설명 카드. 값이 비어도 항상 렌더한다(카드째 숨기면 설명을 새로 쓸 수 없다). */
export function DetailDescription(
  props: React.ComponentProps<typeof InlineDescription>,
) {
  return (
    <Card className="mb-6 p-5">
      <h3 className="mb-2 text-sm font-medium">설명</h3>
      <InlineDescription {...props} />
    </Card>
  );
}

/**
 * 하위 목록: 헤더(이름·개수·추가) · 진행 요약 · 표 카드. 태스크엔 없다(최하위 계층).
 * `add` 는 추가 버튼을 trigger 로 받아 생성 다이얼로그를 돌려준다(버튼 모양·문구를 여기서 통일).
 */
export function ChildList({
  label,
  count,
  progress,
  add,
  children,
}: {
  label: string;
  count: number;
  progress: TaskProgress;
  add: (trigger: React.ReactElement) => React.ReactNode;
  /** `EntityTable` 슬롯. */
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {label} {count}
        </h2>
        {add(
          <Button size="sm" variant="outline">
            <Plus className="size-4" /> {label} 추가
          </Button>,
        )}
      </div>

      <TaskProgressSummary progress={progress} />

      <Card className="mb-6 overflow-hidden py-0">{children}</Card>
    </>
  );
}

/** 메타 카드의 팀 행: 팀 색 점 + key(읽기전용). */
export function TeamRow({
  team,
}: {
  team: { key: string; color: string | null } | null;
}) {
  return (
    <MetaRow label="팀">
      <span className="inline-flex items-center gap-1.5 pr-1.5">
        <span
          className="size-2 shrink-0 rounded-full"
          style={team?.color ? { backgroundColor: team.color } : undefined}
        />
        <span className="text-muted-foreground font-mono text-xs">
          {team?.key}
        </span>
      </span>
    </MetaRow>
  );
}

/** 메타 카드의 MD 롤업 행(하위 항목 MD 합, 읽기전용). */
export function MdRollupRow({
  md,
}: {
  md: { estimated: number; actual: number };
}) {
  return (
    <MetaRow label="MD (롤업)">
      <MdRollupText
        estimated={md.estimated}
        actual={md.actual}
        className="text-sm"
      />
    </MetaRow>
  );
}
