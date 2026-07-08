-- AlterTable
ALTER TABLE "WikiPage" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WikiDraft" (
    "pageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiDraft_pkey" PRIMARY KEY ("pageId","userId")
);

-- CreateIndex
CREATE INDEX "WikiDraft_updatedAt_idx" ON "WikiDraft"("updatedAt");

-- CreateIndex
CREATE INDEX "WikiPage_deletedAt_idx" ON "WikiPage"("deletedAt");

-- AddForeignKey
ALTER TABLE "WikiDraft" ADD CONSTRAINT "WikiDraft_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiDraft" ADD CONSTRAINT "WikiDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
