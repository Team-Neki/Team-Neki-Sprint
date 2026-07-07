import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { getTeams, getMembers, getTeamOptions } from "@/server/queries";
import { deleteTeam } from "@/server/actions/teams";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserBadge } from "@/components/user-badge";
import { TeamDialog } from "@/components/forms/team-dialog";
import { ConfirmDelete } from "@/components/confirm-delete";
import { MemberTeamSelect } from "@/components/teams/member-team-select";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const [teams, members, teamOptions] = await Promise.all([
    getTeams(),
    getMembers(),
    getTeamOptions(),
  ]);

  return (
    <div>
      <PageHeader
        title="팀"
        description="팀은 이슈 key 접두어이자 유저 그룹입니다. 한 사람은 한 팀에 속합니다."
      >
        <TeamDialog
          trigger={
            <Button>
              <Plus className="size-4" /> 새 팀
            </Button>
          }
        />
      </PageHeader>

      {teams.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Users className="text-muted-foreground size-6" />
          </div>
          <p className="text-muted-foreground text-sm">아직 팀이 없습니다.</p>
          <TeamDialog
            trigger={
              <Button variant="outline">
                <Plus className="size-4" /> 첫 팀 만들기
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="mb-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            async function handleDelete() {
              "use server";
              await deleteTeam(t.id);
            }
            return (
              <Card key={t.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={
                        t.color ? { backgroundColor: t.color } : undefined
                      }
                    />
                    <span className="font-mono text-sm font-semibold">
                      {t.key}
                    </span>
                    <span className="text-muted-foreground truncate text-sm">
                      {t.name}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <TeamDialog
                      team={t}
                      trigger={
                        <Button variant="ghost" size="sm">
                          <Pencil className="size-3.5" />
                        </Button>
                      }
                    />
                    <ConfirmDelete
                      onConfirm={handleDelete}
                      description="이슈가 연결된 팀은 삭제할 수 없습니다. 소속 유저는 무소속이 됩니다."
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      }
                    />
                  </div>
                </div>

                <div className="text-muted-foreground flex items-center gap-3 text-xs">
                  <span>멤버 {t._count.members}</span>
                  <span>에픽 {t._count.epics}</span>
                  <span>태스크 {t._count.tasks}</span>
                </div>

                {t.members.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.members.map((m) => (
                      <UserBadge key={m.id} user={m} size="xs" />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">멤버 배정</h2>
      <Card className="divide-border flex flex-col divide-y py-0">
        {members.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            멤버가 없습니다.
          </p>
        )}
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-2">
              <UserBadge user={m} />
              <span className="text-muted-foreground truncate text-xs">
                {m.email}
              </span>
            </div>
            <MemberTeamSelect
              userId={m.id}
              teamId={m.teamId ?? null}
              teams={teamOptions}
            />
          </div>
        ))}
      </Card>
    </div>
  );
}
