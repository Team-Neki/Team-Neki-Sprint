import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { TokenManager } from "@/components/settings/token-manager";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const user = await requireUser();
  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="개인 API 토큰"
        description="MCP 연동에 사용할 개인 토큰입니다. 생성 시 한 번만 표시되니 안전하게 보관하세요."
      />
      <TokenManager tokens={tokens} />
    </div>
  );
}
