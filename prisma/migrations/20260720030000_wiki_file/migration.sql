-- 위키 본문 임의 파일 첨부(WikiFile). 바이너리는 S3 에 두고 여기엔 오브젝트 키(s3Key)만
-- 저장한다(post-S3 WikiImage 와 동형, data 컬럼 없음). name 은 원본 파일명이라 NOT NULL.
-- CreateTable
CREATE TABLE "WikiFile" (
    "id" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiFile_pkey" PRIMARY KEY ("id")
);
