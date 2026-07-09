import { notFound } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  getEpic,
  getProjectOptions,
  getTeamOptions,
  getMembers,
  getEntityActivity,
  getLabelOptions,
} from "@/server/queries";
import { deleteEpic } from "@/server/actions/epics";
import { EpicLabels } from "@/components/detail/epic-labels";
import { formatIssueKey } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TasksTable } from "@/components/tables/tasks-table";
import { TaskDialog } from "@/components/forms/task-dialog";
import { ConfirmDelete } from "@/components/confirm-delete";
import { BackButton } from "@/components/detail/back-button";
import { HistoryPanel } from "@/components/detail/history-panel";
import { MdRollupText } from "@/components/detail/md-rollup";
import {
  MetaRow,
  InlineTitle,
  InlineDescription,
  InlineStatus,
  InlinePriority,
  InlineMember,
  InlineLink,
  InlineDate,
} from "@/components/detail/inline-fields";

export const dynamic = "force-dynamic";

export default async function EpicDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [epic, projects, teams, members, activities, labelOptions] =
    await Promise.all([
      getEpic(id),
      getProjectOptions(),
      getTeamOptions(),
      getMembers(),
      getEntityActivity("epic", id),
      getLabelOptions(),
    ]);
  if (!epic) notFound();

  async function handleDelete() {
    "use server";
    await deleteEpic(id);
  }

  const issueKey = formatIssueKey(epic.team?.key, epic.number);

  return (
    <div className="@container/detail mx-auto max-w-5xl">
      <div className="grid gap-6 @3xl/detail:grid-cols-3">
      <div className="@3xl/detail:col-span-2">
        <BackButton fallback="/epics" label="에픽" />

        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-muted-foreground font-mono text-xs">
              {issueKey}
            </span>
            <InlineTitle type="epic" id={epic.id} value={epic.title} />
          </div>
          <ConfirmDelete
            onConfirm={handleDelete}
            redirectTo="/epics"
            trigger={
              <Button variant="ghost" size="sm" className="text-destructive">
                <Trash2 className="size-4" />
              </Button>
            }
          />
        </div>

        <Card className="mb-6 p-5">
          <h3 className="mb-2 text-sm font-medium">설명</h3>
          <InlineDescription
            type="epic"
            id={epic.id}
            value={epic.description}
          />
        </Card>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">태스크 {epic.tasks.length}</h2>
          <TaskDialog
            members={members}
            teams={teams}
            epics={[{ id: epic.id, title: epic.title, teamId: epic.teamId }]}
            defaultEpicId={epic.id}
            defaultTeamId={epic.teamId}
            trigger={
              <Button size="sm" variant="outline">
                <Plus className="size-4" /> 태스크 추가
              </Button>
            }
          />
        </div>

        <Card className="mb-6 overflow-hidden py-0">
          <TasksTable
            tasks={epic.tasks}
            emptyMessage="연결된 태스크가 없습니다."
          />
        </Card>

        <Card className="p-5">
          <HistoryPanel
            activities={activities}
            members={members}
            projects={projects.map((p) => ({ id: p.id, title: p.title }))}
          />
        </Card>
      </div>

      <div className="@3xl/detail:col-span-1">
        <Card className="flex flex-col gap-3 p-5">
          <MetaRow label="상태">
            <InlineStatus type="epic" id={epic.id} value={epic.status} />
          </MetaRow>
          <MetaRow label="담당자">
            <InlineMember
              type="epic"
              id={epic.id}
              field="ownerId"
              value={epic.owner}
              members={members}
            />
          </MetaRow>
          <MetaRow label="우선순위">
            <InlinePriority type="epic" id={epic.id} value={epic.priority} />
          </MetaRow>
          <MetaRow label="프로젝트">
            <InlineLink
              type="epic"
              id={epic.id}
              field="projectId"
              value={epic.projectId}
              options={projects.map((p) => ({ id: p.id, label: p.title }))}
              noneLabel="없음"
              placeholder="프로젝트 선택"
            />
          </MetaRow>
          <MetaRow label="시작일">
            <InlineDate
              type="epic"
              id={epic.id}
              field="startDate"
              value={epic.startDate}
            />
          </MetaRow>
          <MetaRow label="기한">
            <InlineDate
              type="epic"
              id={epic.id}
              field="dueDate"
              value={epic.dueDate}
            />
          </MetaRow>
          <MetaRow label="팀">
            <span className="inline-flex items-center gap-1.5 pr-1.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={
                  epic.team?.color
                    ? { backgroundColor: epic.team.color }
                    : undefined
                }
              />
              <span className="text-muted-foreground font-mono text-xs">
                {epic.team?.key}
              </span>
            </span>
          </MetaRow>
          <MetaRow label="MD (롤업)">
            <MdRollupText
              estimated={epic.md.estimated}
              actual={epic.md.actual}
              className="text-sm"
            />
          </MetaRow>
          <MetaRow label="라벨" align="start">
            <EpicLabels
              epicId={epic.id}
              labels={epic.labels.map((l) => l.label)}
              allLabels={labelOptions}
            />
          </MetaRow>
        </Card>
      </div>
      </div>
    </div>
  );
}
