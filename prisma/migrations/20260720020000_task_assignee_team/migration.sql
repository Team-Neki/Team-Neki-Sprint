-- 태스크 담당자를 팀 단위로도 지정 가능하게 (B4, additive). 유저 담당자와 상호배타.
ALTER TABLE "Task" ADD COLUMN "assigneeTeamId" TEXT;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeTeamId_fkey" FOREIGN KEY ("assigneeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Task_assigneeTeamId_idx" ON "Task"("assigneeTeamId");
