-- AlterTable: Comment 를 다형(task/epic/project/sprint)으로 확장.
-- taskId 를 nullable 로 완화(기존 태스크 댓글은 그대로 유지) + 나머지 엔티티 FK 컬럼 추가.
ALTER TABLE "Comment" ALTER COLUMN "taskId" DROP NOT NULL,
ADD COLUMN     "epicId" TEXT,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "sprintId" TEXT;

-- CreateIndex
CREATE INDEX "Comment_epicId_createdAt_idx" ON "Comment"("epicId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_projectId_createdAt_idx" ON "Comment"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_sprintId_createdAt_idx" ON "Comment"("sprintId", "createdAt");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Epic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
