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

  const event = req.headers.get("x-github-event") ?? "";
  try {
    await handleGithubEvent(event, JSON.parse(raw) as GithubPayload);
  } catch (e) {
    console.error("[github webhook]", e);
    // 멱등 upsert 라 재전송이 무의미 → 200 으로 확인 처리, 심각 오류만 로깅.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  return NextResponse.json({ ok: true });
}
