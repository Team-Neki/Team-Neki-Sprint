// 위키/리치 본문(Tiptap doc JSON)에서 멘션 대상을 추출한다.
// - personMention: 사용자 id 집합
// - teamMention: 팀 id 집합(알림 시 팀원 전원으로 확장 — server/notify.ts)
// 저장 시 '새로 추가된 멘션'만 알림으로 만들기 위해 저장 전/후 doc 에서
// 각각 집합을 뽑아 차집합을 취하는 데 쓴다(B5).

type DocNode = {
  type?: string;
  attrs?: Record<string, unknown> | null;
  content?: unknown;
};

function extractIds(doc: unknown, nodeType: string): Set<string> {
  const ids = new Set<string>();

  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as DocNode;
    if (n.type === nodeType) {
      const id = n.attrs?.id;
      if (typeof id === "string" && id) ids.add(id);
    }
    if (Array.isArray(n.content)) n.content.forEach(walk);
  }

  walk(doc);
  return ids;
}

/** Tiptap doc JSON 트리를 순회하며 personMention 노드의 userId 집합을 모은다. */
export function extractMentionUserIds(doc: unknown): Set<string> {
  return extractIds(doc, "personMention");
}

/** Tiptap doc JSON 트리를 순회하며 teamMention 노드의 teamId 집합을 모은다. */
export function extractMentionTeamIds(doc: unknown): Set<string> {
  return extractIds(doc, "teamMention");
}
