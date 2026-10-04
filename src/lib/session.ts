import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Returns the current session or null. React cache() 로 요청당 1회만 조회한다
 * (DB 세션 전략이라 auth() 마다 세션 쿼리가 나간다 — 레이아웃·페이지가 각자 불러도 1회).
 */
export const getSession = cache(async () => auth());

/**
 * Returns the signed-in user, redirecting to /login when absent.
 * 승인 전(PENDING) 계정은 /pending 으로 보낸다 — 이 함수가 앱 페이지·서버 액션의
 * 공통 진입 게이트이므로 여기 한 곳에서 가입 승인이 강제된다.
 * 데이터를 읽는 페이지는 (app)/layout 에 기대지 말고 직접 호출한다 — 레이아웃은 클라이언트
 * 내비게이션 때 다시 렌더되지 않는다(Next 문서 authentication.md).
 */
export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.status !== "APPROVED") {
    redirect("/pending");
  }
  return session.user;
});
