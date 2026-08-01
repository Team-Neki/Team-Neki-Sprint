import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  EntityComments,
  type EntityCommentItem,
} from "@/components/comments/entity-comments";
import {
  HistoryPanel,
  type ActivityItem,
} from "@/components/detail/history-panel";
import type { CommentEntityType } from "@/server/actions/comments";
import type { MiniUser } from "@/components/user-badge";
import type { NamedRef } from "@/lib/activity-format";

/**
 * 상세 화면 하단의 댓글 · 업무 히스토리 탭(task/epic/project/sprint 공용).
 * 같은 두 정보를 태스크는 탭, 에픽·프로젝트는 카드 나열, 스프린트는 댓글만으로
 * 서로 다르게 보여주던 것을 하나로 모았다(BACKEND-41). 배치 변경은 여기 한 곳만.
 *
 * 히스토리 문장은 meta 의 id 를 이름으로 바꿔 렌더하므로, 그 해석에 필요한 목록만
 * 골라 넘긴다(안 넘기면 id 가 그대로 보인다 — 에픽은 projects, 프로젝트는 sprints 처럼
 * 자기 화면에서 실제로 바뀌는 참조 필드만 주면 된다).
 */
export function CommentsHistoryTabs({
  entityType,
  entityId,
  comments,
  activities,
  members = [],
  teams = [],
  epics = [],
  projects = [],
  sprints = [],
}: {
  entityType: CommentEntityType;
  entityId: string;
  comments: EntityCommentItem[];
  activities: ActivityItem[];
  members?: MiniUser[];
  teams?: NamedRef[];
  epics?: NamedRef[];
  projects?: NamedRef[];
  sprints?: NamedRef[];
}) {
  return (
    <Tabs defaultValue="comments">
      <TabsList variant="line">
        <TabsTrigger value="comments">댓글 {comments.length}</TabsTrigger>
        <TabsTrigger value="history">업무 히스토리</TabsTrigger>
      </TabsList>

      <TabsContent value="comments" className="mt-4">
        <EntityComments
          entityType={entityType}
          entityId={entityId}
          comments={comments}
        />
      </TabsContent>

      <TabsContent value="history" className="mt-4">
        {/* 탭 라벨이 이미 제목 역할을 하므로 패널 자체 제목은 비운다. */}
        <HistoryPanel
          activities={activities}
          members={members}
          teams={teams}
          epics={epics}
          projects={projects}
          sprints={sprints}
          title=""
        />
      </TabsContent>
    </Tabs>
  );
}
