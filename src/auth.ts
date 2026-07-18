import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/**
 * Auth.js (NextAuth v5) — Google Workspace SSO.
 *
 * Login is restricted to the workspace domain set in ALLOWED_EMAIL_DOMAIN
 * (e.g. "musinsa.com"). Sessions are stored in Postgres via the Prisma adapter,
 * so no separate session store is required.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // hd hints Google to pre-select the workspace domain.
          hd: process.env.ALLOWED_EMAIL_DOMAIN,
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile, user }) {
      const domain = process.env.ALLOWED_EMAIL_DOMAIN;
      const email = profile?.email ?? user?.email ?? "";
      // Enforce workspace domain server-side (hd param alone is not a guarantee).
      if (domain && !email.toLowerCase().endsWith(`@${domain.toLowerCase()}`)) {
        return false;
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: "ADMIN" | "MEMBER" }).role ?? "MEMBER";
        // 미확정 시 PENDING 으로 폴백해 승인 게이트가 열리는 일이 없게 한다.
        session.user.status =
          (user as { status?: "PENDING" | "APPROVED" }).status ?? "PENDING";
      }
      return session;
    },
  },
});
