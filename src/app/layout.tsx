import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
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
  // OG/트위터 이미지의 절대 URL 해석 기준. 배포 도메인이 있으면 env 로 덮어쓴다.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Sprint — 팀 워크스페이스",
    template: "%s · Sprint",
  },
  description:
    "일정과 문서를 한곳에서. Sprint · Project · Epic · Task 관리와 위키.",
  applicationName: "Sprint",
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
