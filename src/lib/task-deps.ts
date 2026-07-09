// 태스크 의존성 그래프 순수 헬퍼. blocker 가 blocked 를 막는다(blocked 는 blocker
// 에 의존). 서버 액션에서 엣지 추가 전 순환을 막는 데 쓰며, DB 접근이 없어 유닛
// 테스트로 커버한다. (schema.prisma TaskDependency, server/actions/tasks.ts)

export type DepEdge = { blockerId: string; blockedId: string };

/**
 * blocker→blocked 엣지(=blocked 가 blocker 에 의존)를 추가하면 순환이 생기는지 판정.
 * 자기 자신(blocker===blocked)도 순환으로 본다. `edges` 는 현재 전체 의존성 엣지.
 *
 * 원리: 추가하려는 의존을 따라가면 blocker 가 (이미) blocked 에 도달 가능하면 순환.
 * dependsOn 인접(어떤 노드를 막는 blocker 집합)을 만들어 blocker 에서 BFS/DFS 로
 * blocked 도달 여부를 확인한다.
 */
export function wouldCreateCycle(
  edges: DepEdge[],
  blockerId: string,
  blockedId: string,
): boolean {
  if (blockerId === blockedId) return true;

  // node -> 그 node 를 막는 blocker 들(dependsOn 방향 인접 리스트).
  const blockersOf = new Map<string, string[]>();
  for (const e of edges) {
    const arr = blockersOf.get(e.blockedId);
    if (arr) arr.push(e.blockerId);
    else blockersOf.set(e.blockedId, [e.blockerId]);
  }

  // blocker 에서 dependsOn 을 따라가며 blockedId 에 도달하면 순환.
  const stack = [blockerId];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop() as string;
    if (cur === blockedId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const next = blockersOf.get(cur);
    if (next) stack.push(...next);
  }
  return false;
}
