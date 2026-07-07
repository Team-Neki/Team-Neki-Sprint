-- AlterTable
ALTER TABLE "WikiPage" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "WikiFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiFolder_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WikiFolder" ADD CONSTRAINT "WikiFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WikiFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WikiPage" ADD CONSTRAINT "WikiPage_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "WikiFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
