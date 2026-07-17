import { prisma } from "@/lib/prisma";

/** 워크스페이스의 활성 설치 하나(단일 워크스페이스 전제). 없으면 null. */
export async function getActiveInstallation() {
  return prisma.githubInstallation.findFirst({
    orderBy: { createdAt: "desc" },
  });
}
