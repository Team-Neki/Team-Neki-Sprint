import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/github/signature";
import {
  handleGithubEvent,
  type GithubPayload,
} from "@/server/github/handle-webhook";

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "GITHUB_WEBHOOK_SECRET 미설정" },
      { status: 500 },
    );
  }

  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  if (!verifyWebhookSignature(raw, sig, secret)) {
    return NextResponse.json({ error: "서명 불일치" }, { status: 401 });
  }

  let payload: GithubPayload;
  try {
    payload = JSON.parse(raw) as GithubPayload;
  } catch {
    return NextResponse.json({ error: "잘못된 JSON" }, { status: 400 });
  }

  const event = req.headers.get("x-github-event") ?? "";
  try {
    await handleGithubEvent(event, payload);
  } catch (e) {
    console.error("[github webhook]", e);
    // 모든 쓰기가 멱등 upsert 라 재시도가 안전하다. 처리 실패는 5xx 로 반환해 GitHub 가
    // 재전송하게 두어야 링크/상태 전이가 유실되지 않는다(200 으로 삼키지 않는다).
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
