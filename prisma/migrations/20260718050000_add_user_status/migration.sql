-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'APPROVED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'PENDING';

-- 기존 가입자는 일괄 승인(같은 트랜잭션 — 승인 대기로 잠기는 창이 없다).
-- 이 시점 이후의 신규 가입만 PENDING 기본값을 받는다.
UPDATE "User" SET "status" = 'APPROVED';
