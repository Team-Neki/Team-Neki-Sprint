import { describe, it, expect } from "vitest";
import { wouldCreateCycle, type DepEdge } from "@/lib/task-deps";

// 표기: blocker→blocked (blocked 가 blocker 에 의존). A→B = "A 가 B 를 막는다".
describe("wouldCreateCycle", () => {
  it("자기 자신 의존은 순환", () => {
    expect(wouldCreateCycle([], "A", "A")).toBe(true);
  });

  it("빈 그래프에 첫 엣지는 순환 아님", () => {
    expect(wouldCreateCycle([], "A", "B")).toBe(false);
  });

  it("직접 역방향(A→B 존재, B→A 추가)은 순환", () => {
    const edges: DepEdge[] = [{ blockerId: "A", blockedId: "B" }];
    // B→A 추가: B 가 A 를 막게 되는데, 이미 A 가 B 를 막고 있어 순환.
    expect(wouldCreateCycle(edges, "B", "A")).toBe(true);
  });

  it("전이 역방향(A→B, B→C 존재, C→A 추가)은 순환", () => {
    const edges: DepEdge[] = [
      { blockerId: "A", blockedId: "B" },
      { blockerId: "B", blockedId: "C" },
    ];
    expect(wouldCreateCycle(edges, "C", "A")).toBe(true);
  });

  it("같은 방향 연장(A→B, B→C 존재, A→C 추가)은 순환 아님(다이아몬드)", () => {
    const edges: DepEdge[] = [
      { blockerId: "A", blockedId: "B" },
      { blockerId: "B", blockedId: "C" },
    ];
    expect(wouldCreateCycle(edges, "A", "C")).toBe(false);
  });

  it("무관한 엣지 추가는 순환 아님", () => {
    const edges: DepEdge[] = [
      { blockerId: "A", blockedId: "B" },
      { blockerId: "C", blockedId: "D" },
    ];
    expect(wouldCreateCycle(edges, "A", "D")).toBe(false);
  });

  it("긴 사슬의 끝에서 처음으로 닫으면 순환", () => {
    const edges: DepEdge[] = [
      { blockerId: "A", blockedId: "B" },
      { blockerId: "B", blockedId: "C" },
      { blockerId: "C", blockedId: "D" },
    ];
    // D→A: D 가 A 를 막으면 A→B→C→D→A 순환.
    expect(wouldCreateCycle(edges, "D", "A")).toBe(true);
    // A→E(신규 노드)는 무관 → 순환 아님.
    expect(wouldCreateCycle(edges, "A", "E")).toBe(false);
  });

  it("공유 blocker(팬아웃)는 순환 아님", () => {
    // A 가 B, C 를 동시에 막음. C→B 추가해도 순환 아님.
    const edges: DepEdge[] = [
      { blockerId: "A", blockedId: "B" },
      { blockerId: "A", blockedId: "C" },
    ];
    expect(wouldCreateCycle(edges, "C", "B")).toBe(false);
  });
});
