-- CreateTable
CREATE TABLE "GithubInstallation" (
    "id" TEXT NOT NULL,
    "installationId" INTEGER NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubBranchLink" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "branchUrl" TEXT NOT NULL,
    "prNumber" INTEGER,
    "prState" TEXT,
    "prUrl" TEXT,
    "prTitle" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubBranchLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubInstallation_installationId_key" ON "GithubInstallation"("installationId");

-- CreateIndex
CREATE INDEX "GithubBranchLink_taskId_idx" ON "GithubBranchLink"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubBranchLink_repoFullName_branchName_key" ON "GithubBranchLink"("repoFullName", "branchName");

-- AddForeignKey
ALTER TABLE "GithubBranchLink" ADD CONSTRAINT "GithubBranchLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

