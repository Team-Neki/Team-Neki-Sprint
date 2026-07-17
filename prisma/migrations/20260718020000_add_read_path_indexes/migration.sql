-- CreateIndex
CREATE INDEX "Comment_taskId_createdAt_idx" ON "Comment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "WikiRevision_pageId_createdAt_idx" ON "WikiRevision"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "WikiPageTaskLink_taskId_idx" ON "WikiPageTaskLink"("taskId");
