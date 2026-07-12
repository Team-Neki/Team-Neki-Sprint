import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * 위키 본문 이미지용 S3 스토리지 래퍼.
 *
 * 자격증명은 코드에 두지 않는다 — AWS SDK 의 기본 credential provider chain
 * (k8s 의 IRSA/IAM Role, 로컬은 ~/.aws 또는 AWS_ACCESS_KEY_ID env)을 그대로 쓴다.
 * 버킷·리전만 env 로 주입한다. S3_ENDPOINT 를 주면 MinIO 등 S3 호환 스토리지로도
 * 붙는다(로컬 개발용). 클라이언트는 최초 사용 시 지연 생성 — 빌드 타임(env 부재)에
 * 모듈 임포트만으로 터지지 않도록.
 */

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  const region = process.env.S3_REGION;
  if (!region) {
    throw new Error("S3_REGION 환경변수가 필요합니다");
  }
  const endpoint = process.env.S3_ENDPOINT || undefined;
  client = new S3Client({
    region,
    // MinIO 등 경로형 접근이 필요한 S3 호환 스토리지 지원.
    ...(endpoint
      ? { endpoint, forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" }
      : {}),
  });
  return client;
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error("S3_BUCKET 환경변수가 필요합니다");
  }
  return bucket;
}

/** 위키 이미지 오브젝트 키 프리픽스. */
const KEY_PREFIX = "wiki-images/";

/** 새 위키 이미지용 오브젝트 키를 생성한다(추측 불가한 랜덤). */
export function newWikiImageKey(): string {
  return `${KEY_PREFIX}${crypto.randomUUID()}`;
}

/** 이미지 바이너리를 S3 에 저장. */
export async function putWikiImage(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** S3 에서 이미지를 받아 (웹 스트림, 바이트 길이)로 반환. 없으면 null. */
export async function getWikiImage(
  key: string,
): Promise<{ body: ReadableStream; contentLength?: number } | null> {
  try {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    );
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream(),
      contentLength: res.ContentLength,
    };
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "NoSuchKey" || err.name === "NotFound")
    ) {
      return null;
    }
    throw err;
  }
}

/** S3 에서 이미지를 삭제(고아 정리용). 키가 없어도 조용히 성공. */
export async function deleteWikiImage(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
  );
}
