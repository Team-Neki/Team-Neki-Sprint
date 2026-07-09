import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SprintMark } from "@/components/logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-sm shadow-sm">
        <CardContent className="flex flex-col items-center gap-6 py-10">
          <div className="text-center">
            <SprintMark className="mx-auto mb-4 size-11" />
            <h1 className="text-xl font-semibold tracking-tight">Sprint</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              팀 일정과 문서를 한곳에서
            </p>
          </div>

          {error === "AccessDenied" && (
            <p className="text-destructive bg-destructive/10 w-full rounded-md px-3 py-2 text-center text-xs">
              허용된 워크스페이스 계정으로만 로그인할 수 있어요.
            </p>
          )}

          <form
            className="w-full"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <Button type="submit" className="w-full gap-2" size="lg">
              <GoogleIcon />
              Google로 계속하기
            </Button>
          </form>

          <p className="text-muted-foreground text-center text-xs leading-relaxed">
            회사 Google 계정으로 로그인하면
            <br />
            자동으로 팀 워크스페이스에 참여합니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.5C17.3 3 14.9 2 12 2 6.9 2 2.8 6.1 2.8 11.2S6.9 20.4 12 20.4c5.9 0 9.8-4.1 9.8-9.9 0-.7-.1-1.2-.2-1.7H12z"
      />
    </svg>
  );
}
