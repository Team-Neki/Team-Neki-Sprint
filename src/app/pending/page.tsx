import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SprintMark } from "@/components/logo";

/**
 * 가입 승인 대기 화면. requireUser 가 PENDING 계정을 이곳으로 보낸다.
 * (app) 그룹 밖에 두어 앱 셸(requireUser)과의 리다이렉트 루프를 피한다.
 */
export default async function PendingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.status === "APPROVED") redirect("/dashboard");

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-sm shadow-sm">
        <CardContent className="flex flex-col items-center gap-6 py-10">
          <div className="text-center">
            <SprintMark className="mx-auto mb-4 size-11" />
            <h1 className="text-xl font-semibold tracking-tight">
              승인 대기 중
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              가입 신청이 접수됐어요. 관리자 승인 후 이용할 수 있습니다.
            </p>
          </div>

          <p className="text-muted-foreground text-center text-xs leading-relaxed">
            {session.user.email} 계정으로 신청됨
            <br />
            승인이 늦어지면 관리자에게 문의해 주세요.
          </p>

          <form
            className="w-full"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              로그아웃
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
