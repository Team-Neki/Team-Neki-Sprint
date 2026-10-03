import type { z } from "zod";

/**
 * 부분 수정(patch) 입력 검증. zod 4 의 `.partial()` 은 입력에 없는 키에도 `.default()` 값을
 * 채운다(`{ title }` 만 보내도 status·priority 가 기본값으로 붙음). 그대로 diff 하면 단일 필드
 * 인라인 편집·MCP PATCH 가 상태·우선순위를 기본값으로 되돌리므로, 입력에 있던 키만 남긴다.
 */
export function parsePatch(
  schema: z.ZodObject,
  input: unknown,
): Record<string, unknown> {
  const parsed = schema.partial().parse(input) as Record<string, unknown>;
  const given = input as Record<string, unknown>;
  return Object.fromEntries(Object.entries(parsed).filter(([k]) => k in given));
}
