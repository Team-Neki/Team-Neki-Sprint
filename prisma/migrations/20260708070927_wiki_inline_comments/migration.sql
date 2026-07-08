-- CreateTable
CREATE TABLE "WikiCommentThread" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiCommentThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiComment" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WikiCommentThread_pageId_resolved_idx" ON "WikiCommentThread"("pageId", "resolved");

-- CreateIndex
CREATE INDEX "WikiComment_threadId_createdAt_idx" ON "WikiComment"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "WikiCommentThread" ADD CONSTRAINT "WikiCommentThread_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiComment" ADD CONSTRAINT "WikiComment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "WikiCommentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiComment" ADD CONSTRAINT "WikiComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
