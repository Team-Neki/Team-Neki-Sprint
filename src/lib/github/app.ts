import { createSign } from "node:crypto";

const API = "https://api.github.com";
// GitHub 장애 시 서버 액션/요청 자원이 무기한 묶이지 않도록 각 호출에 상한을 둔다.
const TIMEOUT_MS = 10_000;

/** App 인증용 단기 JWT(RS256). 만료 <=10분. */
function appJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  const pkey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !pkey) {
    throw new Error("GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY 미설정");
  }
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const data = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId,
  })}`;
  const sig = createSign("RSA-SHA256")
    .update(data)
    .sign(pkey.replace(/\\n/g, "\n"), "base64url");
  return `${data}.${sig}`;
}

/** installation access token 발급(1시간 만료). */
async function installationToken(installationId: number): Promise<string> {
  const res = await fetch(
    `${API}/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) {
    throw new Error(`installation token 발급 실패: ${res.status}`);
  }
  const json = (await res.json()) as { token: string };
  return json.token;
}

/**
 * installation 토큰으로 GitHub REST 호출. path 는 "/repos/..." 형태.
 * MVP: 호출마다 토큰 발급(현 규모에서 충분). 필요 시 만료 캐시로 최적화.
 */
export async function githubFetch(
  installationId: number,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await installationToken(installationId);
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS),
  });
}
