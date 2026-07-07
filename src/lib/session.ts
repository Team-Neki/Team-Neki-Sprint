import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Returns the current session or null. */
export async function getSession() {
  return auth();
}

/** Returns the signed-in user, redirecting to /login when absent. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}
