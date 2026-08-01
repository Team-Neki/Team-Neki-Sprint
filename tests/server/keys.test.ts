import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { nextTeamNumber } from "@/server/keys";

/**
 * nextTeamNumber 의 원자성 계약을 fake tx 로 검증한다(DB 불필요).
 * 실제 원자성은 prisma 의 increment + $transaction 이 보장하므로, 여기선
 * "increment 로 +1 하고 새 seq 를 그대로 반환한다"는 계약만 고정한다.
 */
describe("nextTeamNumber", () => {
  it("increments Team.seq atomically and returns the new value", async () => {
    const update = vi.fn().mockResolvedValue({ seq: 42 });
    const tx = { team: { update } } as unknown as Prisma.TransactionClient;

    const n = await nextTeamNumber(tx, "team-1");

    expect(n).toBe(42);
    expect(update).toHaveBeenCalledWith({
      where: { id: "team-1" },
      data: { seq: { increment: 1 } },
      select: { seq: true },
    });
  });

  it("returns distinct increasing numbers across sequential calls", async () => {
    let seq = 0;
    const update = vi.fn().mockImplementation(async () => ({ seq: ++seq }));
    const tx = { team: { update } } as unknown as Prisma.TransactionClient;

    const a = await nextTeamNumber(tx, "t");
    const b = await nextTeamNumber(tx, "t");
    const c = await nextTeamNumber(tx, "t");

    expect([a, b, c]).toEqual([1, 2, 3]);
  });
});
