-- AlterTable
-- 초안 페이지(UI '새 페이지'로 만들고 아직 저장하지 않음). 기존 페이지는 전부
-- 정식(false) — default 로 충분해 백필 불필요.
ALTER TABLE "WikiPage" ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT false;
