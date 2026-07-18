import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "MEMBER";
      status: "PENDING" | "APPROVED";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "ADMIN" | "MEMBER";
    status?: "PENDING" | "APPROVED";
  }
}
