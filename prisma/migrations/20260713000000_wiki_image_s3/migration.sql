-- 위키 이미지 바이너리를 DB(BYTEA)에서 S3 오브젝트 키 참조로 이관한다.
-- 기존 이미지 데이터가 없다는 전제(테이블 empty)이므로 s3Key 를 NOT NULL 로 바로 추가한다.
ALTER TABLE "WikiImage" DROP COLUMN "data";
ALTER TABLE "WikiImage" ADD COLUMN "s3Key" TEXT NOT NULL;
