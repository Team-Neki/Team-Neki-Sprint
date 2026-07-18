import { prisma } from "@/lib/prisma";

/** Parse "TEAM-123" (case-insensitive key) into its parts, or null if not a key. */
export function parseIssueKey(
  s: string,
): { teamKey: string; number: number } | null {
  const m = s.trim().match(/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/);
  if (!m) return null;
  return { teamKey: m[1].toUpperCase(), number: Number(m[2]) };
}

/** Resolve a task id given either a cuid or a "TEAM-123" key. Returns the id or null. */
export async function resolveTaskId(idOrKey: string): Promise<string | null> {
  const key = parseIssueKey(idOrKey);
  if (key) {
    const task = await prisma.task.findFirst({
      where: {
        number: key.number,
        team: { key: { equals: key.teamKey, mode: "insensitive" } },
      },
      select: { id: true },
    });
    return task?.id ?? null;
  }
  const byId = await prisma.task.findUnique({
    where: { id: idOrKey },
    select: { id: true },
  });
  return byId?.id ?? null;
}

/** Resolve a team id from a team id or a team key (e.g. "NEKI"). Returns id or null. */
export async function resolveTeamId(idOrKey: string): Promise<string | null> {
  const team = await prisma.team.findFirst({
    where: {
      OR: [
        { id: idOrKey },
        { key: { equals: idOrKey.toUpperCase(), mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return team?.id ?? null;
}

/** Resolve a user id from a user id or an email. Returns id or null. */
export async function resolveUserId(idOrEmail: string): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { OR: [{ id: idOrEmail }, { email: idOrEmail.toLowerCase() }] },
    select: { id: true },
  });
  return user?.id ?? null;
}
