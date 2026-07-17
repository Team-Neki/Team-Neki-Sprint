// 설명(description)·댓글(body)의 리치 텍스트 저장/표시 헬퍼(B6).
//
// 저장: 기존 String 컬럼에 Tiptap doc JSON 을 문자열로 그대로 넣는다(스키마 변경
// 없음, additive). 레거시 plain text 값도 있으므로, 읽을 때 JSON 이면 doc 으로,
// 아니면 단락으로 감싼 doc 으로 정규화한다. 멘션 추출은 lib/mentions 재사용.

import type { JSONContent } from "@tiptap/core";
import { extractMentionUserIds, extractMentionTeamIds } from "@/lib/mentions";

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

/** 저장 문자열(JSON 또는 레거시 plain text) → Tiptap doc JSON. */
export function parseDoc(value: string | null | undefined): JSONContent {
  if (!value) return EMPTY_DOC;
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as JSONContent;
      if (parsed && parsed.type === "doc") return parsed;
    } catch {
      // JSON 파싱 실패 → 아래 plain text 폴백.
    }
  }
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
  };
}

/** doc JSON → 순수 텍스트(히스토리·발췌·검색용). 멘션/티켓 칩은 라벨로. */
export function docToPlainText(doc: JSONContent): string {
  let out = "";
  const walk = (node: JSONContent | undefined) => {
    if (!node) return;
    if (node.type === "personMention" || node.type === "teamMention") {
      out += `@${(node.attrs?.label as string) ?? ""}`;
      return;
    }
    if (node.type === "ticketMention") {
      out += (node.attrs?.label as string) ?? "";
      return;
    }
    if (typeof node.text === "string") out += node.text;
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
      if (node.type === "paragraph" || node.type === "heading") out += "\n";
    }
  };
  walk(doc);
  return out.replace(/\n{2,}/g, "\n").trim();
}

/** 저장 문자열 → 순수 텍스트(레거시 plain text 도 그대로 통과). */
export function plainTextOf(value: string | null | undefined): string {
  return docToPlainText(parseDoc(value));
}

/** 내용이 비었는지(공백만) — 빈 저장/댓글 방지 검증용. */
export function isValueEmpty(value: string | null | undefined): boolean {
  return docToPlainText(parseDoc(value)).length === 0;
}

/** 저장 문자열에서 멘션된 사용자 id 집합. */
export function mentionsInValue(value: string | null | undefined): Set<string> {
  return extractMentionUserIds(parseDoc(value));
}

/** 저장 문자열에서 멘션된 팀 id 집합(팀 멘션 → 알림 시 팀원 전원으로 확장). */
export function teamMentionsInValue(
  value: string | null | undefined,
): Set<string> {
  return extractMentionTeamIds(parseDoc(value));
}

/**
 * 검색어(query) 주변을 잘라낸 발췌(전역 검색 본문 매칭 표시용). 대소문자 무시로
 * 첫 매칭을 찾아 앞뒤 radius 글자만큼 창을 잡고, 잘린 쪽에 말줄임(…)을 붙인다.
 * 매칭이 없으면 앞부분(radius*2)을 반환. 공백은 단일화한다.
 */
export function searchExcerpt(
  text: string | null | undefined,
  query: string,
  radius = 40,
): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const q = query.trim();
  const idx = q ? clean.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (idx < 0) {
    const head = clean.slice(0, radius * 2);
    return head.length < clean.length ? `${head}…` : head;
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(clean.length, idx + q.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";
  return `${prefix}${clean.slice(start, end)}${suffix}`;
}
