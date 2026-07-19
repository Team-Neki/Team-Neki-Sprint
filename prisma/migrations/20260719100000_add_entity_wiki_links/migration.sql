-- CreateTable
CREATE TABLE "WikiPageEpicLink" (
    "pageId" TEXT NOT NULL,
    "epicId" TEXT NOT NULL,

    CONSTRAINT "WikiPageEpicLink_pkey" PRIMARY KEY ("pageId","epicId")
);

-- CreateTable
CREATE TABLE "WikiPageProjectLink" (
    "pageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "WikiPageProjectLink_pkey" PRIMARY KEY ("pageId","projectId")
);

-- CreateTable
CREATE TABLE "WikiPageSprintLink" (
    "pageId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,

    CONSTRAINT "WikiPageSprintLink_pkey" PRIMARY KEY ("pageId","sprintId")
);

-- CreateIndex
CREATE INDEX "WikiPageEpicLink_epicId_idx" ON "WikiPageEpicLink"("epicId");

-- CreateIndex
CREATE INDEX "WikiPageProjectLink_projectId_idx" ON "WikiPageProjectLink"("projectId");

-- CreateIndex
CREATE INDEX "WikiPageSprintLink_sprintId_idx" ON "WikiPageSprintLink"("sprintId");

-- AddForeignKey
ALTER TABLE "WikiPageEpicLink" ADD CONSTRAINT "WikiPageEpicLink_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPageEpicLink" ADD CONSTRAINT "WikiPageEpicLink_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Epic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPageProjectLink" ADD CONSTRAINT "WikiPageProjectLink_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPageProjectLink" ADD CONSTRAINT "WikiPageProjectLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPageSprintLink" ADD CONSTRAINT "WikiPageSprintLink_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPageSprintLink" ADD CONSTRAINT "WikiPageSprintLink_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
