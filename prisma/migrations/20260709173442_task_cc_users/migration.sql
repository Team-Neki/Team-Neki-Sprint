-- CreateTable
CREATE TABLE "_TaskCc" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskCc_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TaskCc_B_index" ON "_TaskCc"("B");

-- AddForeignKey
ALTER TABLE "_TaskCc" ADD CONSTRAINT "_TaskCc_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskCc" ADD CONSTRAINT "_TaskCc_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
