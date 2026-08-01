/**
 * OG/트위터 이미지의 절대 URL 을 만드는 기준(metadataBase)이 되는 공개 URL.
 *
 * 값의 출처는 `NEXT_PUBLIC_APP_URL` 이고, 이 변수는 **`next build` 시점에 인라인**된다
 * (next docs "Bundling Environment Variables for the Browser": NEXT_PUBLIC_* 는 Node.js
 * 환경의 참조까지 빌드 당시 값으로 치환된다). 따라서 k8s ConfigMap 등 **런타임 env 로는
 * 덮어쓸 수 없고**, 반드시 Dockerfile 의 build arg 로 주입해야 한다. 주입을 빠뜨리면
 * localhost 로 폴백해 카카오톡/슬랙 링크 미리보기의 og:image 가 깨진다.
 *
 * 빈 문자열(build arg 를 넘겼지만 값이 비어 있는 경우)도 미설정으로 취급한다 — `??` 는
 * 빈 문자열을 통과시켜 `new URL("")` 로 빌드를 터뜨린다.
 */
export function resolveAppUrl(raw: string | undefined | null): string {
  return raw?.trim() || "http://localhost:3000";
}
