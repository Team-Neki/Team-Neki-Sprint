import { describe, it, expect } from "vitest";
import {
  isRichDoc,
  sprintSchema,
  teamSchema,
  projectSchema,
  epicSchema,
  taskSchema,
  wikiPageSchema,
  wikiFolderSchema,
  wikiCommentBodySchema,
  statusEnum,
  priorityEnum,
  sprintStatusEnum,
  assigneeIdSchema,
} from "@/lib/validators";

// 핵심 회귀: optional id/date 필드가 .nullish() 로 null·undefined·"" 를 모두
// null 로 정규화하는지. 예전에 .optional() 만 걸어 "" 입력에서 ZodError 로 저장이
// 통째로 날아간 버그가 있었다(CLAUDE.md 필독 항목).

describe("optionalId 정규화 (taskSchema.epicId 로 대표 검증)", () => {
  const base = { title: "T", teamId: "team-1" };

  it("null → null 로 통과", () => {
    const r = taskSchema.parse({ ...base, epicId: null });
    expect(r.epicId).toBeNull();
  });

  it("undefined(키 없음) → null 로 통과", () => {
    const r = taskSchema.parse({ ...base });
    expect(r.epicId).toBeNull();
  });

  it('"" → null 로 정규화', () => {
    const r = taskSchema.parse({ ...base, epicId: "" });
    expect(r.epicId).toBeNull();
  });

  it("공백만 있는 문자열 → trim 후 null", () => {
    const r = taskSchema.parse({ ...base, epicId: "   " });
    expect(r.epicId).toBeNull();
  });

  it("실제 값 → trim 되어 그대로 통과", () => {
    const r = taskSchema.parse({ ...base, epicId: "  epic-9  " });
    expect(r.epicId).toBe("epic-9");
  });
});

describe("optionalDate 정규화", () => {
  const base = { title: "T", teamId: "team-1" };

  it('null/undefined/"" → null', () => {
    expect(taskSchema.parse({ ...base, startDate: null }).startDate).toBeNull();
    expect(taskSchema.parse({ ...base }).startDate).toBeNull();
    expect(taskSchema.parse({ ...base, startDate: "" }).startDate).toBeNull();
  });

  it("ISO 날짜 문자열 → Date 객체", () => {
    const r = taskSchema.parse({ ...base, dueDate: "2026-07-08" });
    expect(r.dueDate).toBeInstanceOf(Date);
    expect((r.dueDate as Date).getUTCFullYear()).toBe(2026);
  });
});

describe("requiredId (teamId)", () => {
  it("teamId 누락 시 실패", () => {
    expect(() => taskSchema.parse({ title: "T" })).toThrow();
  });

  it('teamId 빈 문자열 시 실패', () => {
    expect(() => taskSchema.parse({ title: "T", teamId: "" })).toThrow();
    expect(() => taskSchema.parse({ title: "T", teamId: "  " })).toThrow();
  });

  it("teamId 있으면 성공", () => {
    expect(taskSchema.parse({ title: "T", teamId: "team-1" }).teamId).toBe(
      "team-1",
    );
  });
});

describe("optionalMd (estimatedMd/actualMd) 정규화", () => {
  const base = { title: "T", teamId: "team-1" };

  it('""/null/undefined → null', () => {
    expect(taskSchema.parse({ ...base, estimatedMd: "" }).estimatedMd).toBeNull();
    expect(
      taskSchema.parse({ ...base, estimatedMd: null }).estimatedMd,
    ).toBeNull();
    expect(taskSchema.parse({ ...base }).estimatedMd).toBeNull();
  });

  it("숫자 문자열 → 숫자로 coerce", () => {
    expect(taskSchema.parse({ ...base, estimatedMd: "3.5" }).estimatedMd).toBe(
      3.5,
    );
  });

  it("음수는 거부", () => {
    expect(() => taskSchema.parse({ ...base, estimatedMd: -1 })).toThrow();
  });
});

describe("taskSchema 기본값", () => {
  const base = { title: "T", teamId: "team-1" };

  it("status/priority 기본값", () => {
    const r = taskSchema.parse(base);
    expect(r.status).toBe("TODO");
    expect(r.priority).toBe("MEDIUM");
  });

  it("title 은 필수(빈 값 거부)", () => {
    expect(() => taskSchema.parse({ ...base, title: "" })).toThrow();
    expect(() => taskSchema.parse({ ...base, title: "   " })).toThrow();
  });

});

describe("projectSchema", () => {
  it("기본값 BACKLOG/MEDIUM + optional 관계 null 정규화", () => {
    const r = projectSchema.parse({ title: "P" });
    expect(r.status).toBe("BACKLOG");
    expect(r.priority).toBe("MEDIUM");
    expect(r.ownerId).toBeNull();
    expect(r.sprintId).toBeNull();
    expect(r.startDate).toBeNull();
    expect(r.dueDate).toBeNull();
  });

  it("title 필수", () => {
    expect(() => projectSchema.parse({})).toThrow();
  });
});

describe("epicSchema", () => {
  it("teamId 필수(requiredId)", () => {
    expect(() => epicSchema.parse({ title: "E" })).toThrow();
    const r = epicSchema.parse({ title: "E", teamId: "t1" });
    expect(r.teamId).toBe("t1");
    expect(r.projectId).toBeNull();
  });
});

describe("sprintSchema", () => {
  it("name 필수, status 기본 PLANNED, 날짜 정규화", () => {
    const r = sprintSchema.parse({ name: "S1" });
    expect(r.status).toBe("PLANNED");
    expect(r.startDate).toBeNull();
    expect(r.endDate).toBeNull();
    expect(() => sprintSchema.parse({ name: "" })).toThrow();
  });

  it("name 200자 초과 거부", () => {
    expect(() => sprintSchema.parse({ name: "a".repeat(201) })).toThrow();
  });
});

describe("teamSchema", () => {
  it("이미 대문자/숫자인 key 는 통과(transform 은 no-op)", () => {
    // 주의: regex(/^[A-Z0-9]+$/) 가 transform(toUpperCase) 보다 먼저 실행되므로
    // 소문자 입력은 대문자로 바뀌기 전에 regex 에서 걸린다(아래 케이스 참고).
    const r = teamSchema.parse({ key: "ABC12", name: "팀" });
    expect(r.key).toBe("ABC12");
  });

  it("소문자 key 는 regex 단계에서 거부(대문자 변환 전)", () => {
    expect(() => teamSchema.parse({ key: "abc12", name: "팀" })).toThrow();
  });

  it("key 에 특수문자/공백/빈 값 있으면 거부", () => {
    expect(() => teamSchema.parse({ key: "A-B", name: "팀" })).toThrow();
    expect(() => teamSchema.parse({ key: "", name: "팀" })).toThrow();
  });

  it("color 는 optional·nullable", () => {
    expect(teamSchema.parse({ key: "AB", name: "팀", color: null }).color).toBeNull();
    expect(teamSchema.parse({ key: "AB", name: "팀" }).color).toBeUndefined();
  });
});

describe("wiki 스키마", () => {
  it("wikiPageSchema: title 필수 + parentId/folderId null 정규화", () => {
    const r = wikiPageSchema.parse({ title: "W", parentId: "", folderId: null });
    expect(r.parentId).toBeNull();
    expect(r.folderId).toBeNull();
    expect(() => wikiPageSchema.parse({ title: "" })).toThrow();
  });

  it("wikiFolderSchema: name 필수", () => {
    expect(() => wikiFolderSchema.parse({ name: "" })).toThrow();
    expect(wikiFolderSchema.parse({ name: "폴더" }).parentId).toBeNull();
  });

  it("wikiCommentBodySchema: 1~2000자, trim 적용", () => {
    expect(wikiCommentBodySchema.parse("  hi  ")).toBe("hi");
    expect(() => wikiCommentBodySchema.parse("   ")).toThrow();
    expect(() => wikiCommentBodySchema.parse("a".repeat(2001))).toThrow();
  });
});

describe("단일 필드 인라인 편집 스키마", () => {
  it("statusEnum/priorityEnum/sprintStatusEnum 유효값·무효값", () => {
    expect(statusEnum.parse("DONE")).toBe("DONE");
    expect(() => statusEnum.parse("NOPE")).toThrow();
    expect(priorityEnum.parse("URGENT")).toBe("URGENT");
    expect(() => priorityEnum.parse("meh")).toThrow();
    expect(sprintStatusEnum.parse("ACTIVE")).toBe("ACTIVE");
    expect(() => sprintStatusEnum.parse("PLANNED_X")).toThrow();
  });

  it("assigneeIdSchema: 값 또는 null 허용, 빈 문자열은 거부", () => {
    expect(assigneeIdSchema.parse("u1")).toBe("u1");
    expect(assigneeIdSchema.parse(null)).toBeNull();
    expect(() => assigneeIdSchema.parse("")).toThrow();
  });
});

describe("isRichDoc (Tiptap 본문 doc 최소 방어)", () => {
  it("최상위 { type: 'doc' } 객체만 허용", () => {
    expect(isRichDoc({ type: "doc", content: [] })).toBe(true);
    expect(isRichDoc({ type: "paragraph" })).toBe(false);
    expect(isRichDoc({})).toBe(false);
    expect(isRichDoc([])).toBe(false);
    expect(isRichDoc("doc")).toBe(false);
    expect(isRichDoc(null)).toBe(false);
    expect(isRichDoc(undefined)).toBe(false);
  });

  it("직렬화 크기 상한을 넘으면 거부", () => {
    const big = {
      type: "doc",
      content: [{ type: "text", text: "x".repeat(100) }],
    };
    expect(isRichDoc(big, 50)).toBe(false);
    expect(isRichDoc(big)).toBe(true);
  });

  it("직렬화 불가(순환 참조) 문서는 거부", () => {
    const cyclic: { type: string; self?: unknown } = { type: "doc" };
    cyclic.self = cyclic;
    expect(isRichDoc(cyclic)).toBe(false);
  });
});
