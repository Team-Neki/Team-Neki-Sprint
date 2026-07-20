-- CreateTable: 유저별 PLP 표 컬럼 순서·노출 설정(F4). (userId, table) 당 1건.
CREATE TABLE "UserColumnPref" (
    "userId" TEXT NOT NULL,
    "table" TEXT NOT NULL,
    "columns" JSONB NOT NULL,

    CONSTRAINT "UserColumnPref_pkey" PRIMARY KEY ("userId","table")
);

-- AddForeignKey
ALTER TABLE "UserColumnPref" ADD CONSTRAINT "UserColumnPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
