import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Liveness/readiness probe target. Does not touch the DB so it stays green
// even during transient DB blips; app readiness is about the process serving.
export function GET() {
  return NextResponse.json({ status: "ok" });
}
