-- IN_REVIEW 상태 제거: 기존 IN_REVIEW 행은 BACKLOG 로 이관 후 enum 재생성.
UPDATE "Task" SET "status" = 'BACKLOG' WHERE "status" = 'IN_REVIEW';
UPDATE "Epic" SET "status" = 'BACKLOG' WHERE "status" = 'IN_REVIEW';
UPDATE "Project" SET "status" = 'BACKLOG' WHERE "status" = 'IN_REVIEW';

-- Postgres enum 은 값 제거가 불가 → 타입 재생성 후 컬럼 캐스팅.
ALTER TYPE "Status" RENAME TO "Status_old";
CREATE TYPE "Status" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE');
ALTER TABLE "Project" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Epic" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "status" TYPE "Status" USING ("status"::text::"Status");
ALTER TABLE "Epic" ALTER COLUMN "status" TYPE "Status" USING ("status"::text::"Status");
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "Status" USING ("status"::text::"Status");
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'BACKLOG';
ALTER TABLE "Epic" ALTER COLUMN "status" SET DEFAULT 'BACKLOG';
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'TODO';
DROP TYPE "Status_old";
