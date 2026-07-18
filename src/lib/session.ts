import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Returns the current session or null. */
export async function getSession() {
  return auth();
}

/**
 * Returns the signed-in user, redirecting to /login when absent.
 * 승인 전(PENDING) 계정은 /pending 으로 보낸다 — 이 함수가 앱 페이지·서버 액션의
 * 공통 진입 게이트이므로 여기 한 곳에서 가입 승인이 강제된다.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.status !== "APPROVED") {
    redirect("/pending");
  }
  return session.user;
}
