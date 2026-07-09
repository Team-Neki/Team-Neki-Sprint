-- storyPoints 제거: 추정은 estimatedMd/actualMd(MD)로 일원화.
ALTER TABLE "Task" DROP COLUMN "storyPoints";
