import { z } from "zod";
import type { JSONContent } from "@tiptap/core";

/**
 * Tiptap doc(JSONContent)의 최소 구조 검증. 노드 트리 전체를 재귀 검증하진 않되,
 * 최상위가 `{ type: "doc", content?: [...] }` 형태인지 확인해 `z.unknown()` 대비
 * 코어(updateWikiContentCore)가 기대하는 계약을 보장한다. 원본 객체를 그대로 통과시킨다
 * (refine 은 값을 변형하지 않음 → 노드 attrs/marks 등 손실 없음).
 */
export const tiptapDocSchema = z.unknown().refine(
  (v): v is JSONContent =>
    !!v &&
    typeof v === "object" &&
    (v as { type?: unknown }).type === "doc" &&
    (("content" in (v as object)) ? Array.isArray((v as { content?: unknown }).content) : true),
  { message: "contentJson must be a Tiptap doc ({ type: 'doc', content: [...] })" },
);
