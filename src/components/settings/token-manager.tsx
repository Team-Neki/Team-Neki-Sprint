"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { createApiToken, revokeApiToken } from "@/server/actions/api-tokens";

type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export function TokenManager({ tokens }: { tokens: TokenRow[] }) {
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onCreate() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { raw } = await createApiToken(name.trim());
      setNewToken(raw);
      setName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="토큰 이름 (예: MCP - 노트북)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCreate()}
        />
        <Button onClick={onCreate} disabled={busy || !name.trim()}>
          생성
        </Button>
      </div>

      {newToken && (
        <Card>
          <CardContent className="py-3">
            <p className="text-foreground text-sm">
              아래 토큰은 지금만 표시됩니다. 복사해 두세요.
            </p>
            <div className="mt-2 flex gap-2">
              <code className="bg-muted flex-1 truncate rounded-md px-2 py-1 text-xs">
                {newToken}
              </code>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(newToken);
                  toast.success("복사됨");
                }}
              >
                복사
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="divide-y p-0">
          {tokens.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-sm">
              발급된 토큰이 없습니다.
            </p>
          ) : (
            tokens.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-foreground text-sm font-medium">{t.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {t.prefix}… · 마지막 사용{" "}
                    {t.lastUsedAt
                      ? new Date(t.lastUsedAt).toLocaleDateString()
                      : "없음"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await revokeApiToken(t.id);
                    toast.success("폐기됨");
                  }}
                >
                  폐기
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
