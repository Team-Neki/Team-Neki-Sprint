import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { resolveAppUrl } from "@/lib/app-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // OG/트위터 이미지의 절대 URL 해석 기준. NEXT_PUBLIC_APP_URL 은 next build 시점에
  // 인라인되므로 Dockerfile 의 build arg 로만 주입된다 — 상세는 lib/app-url.ts 주석.
  metadataBase: new URL(resolveAppUrl(process.env.NEXT_PUBLIC_APP_URL)),
  title: {
    default: "Sprint — 팀 워크스페이스",
    template: "%s · Sprint",
  },
  description:
    "일정과 문서를 한곳에서. Sprint · Project · Epic · Task 관리와 위키.",
  applicationName: "Sprint",
  // 사내 전용 워크스페이스 — 검색 색인에서 뺀다. 링크 미리보기(og:*)는 색인과
  // 별개라 그대로 동작한다. 크롤 허용 범위는 app/robots.ts 참고.
  robots: { index: false, follow: false },
  // og/twitter 이미지는 app/opengraph-image.tsx 가 자동 주입(여기 명시 불필요).
  openGraph: {
    type: "website",
    siteName: "Sprint",
    title: "Sprint — 팀 워크스페이스",
    description:
      "일정과 문서를 한곳에서. Sprint · Project · Epic · Task 관리와 위키.",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sprint — 팀 워크스페이스",
    description: "일정과 문서를 한곳에서. 스프린트·프로젝트·에픽·태스크 + 위키.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background min-h-full">
        {children}
        <Toaster theme="light" richColors position="top-center" />
      </body>
    </html>
  );
}
